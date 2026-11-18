const BaseAIProvider = require('./provider-interface');
const env = require('../../config/env');

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';
const DEFAULT_OLLAMA_CONTEXT_LENGTH = 8192;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Local-First Ollama AI Provider Adapter (Phase 5)
 *
 * Executes inference strictly on the local machine via Ollama's HTTP API
 * (`POST http://localhost:11434/api/chat`) using `qwen2.5:3b` by default.
 *
 * Privacy & Security Guarantees:
 * - Restricts `baseUrl` strictly to localhost/loopback addresses.
 * - Never falls back to cloud providers.
 * - Never logs raw policy text.
 */
class OllamaProvider extends BaseAIProvider {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.baseUrl] - Local Ollama server URL (defaults to http://localhost:11434)
   * @param {string} [options.defaultModel] - Default Ollama model (defaults to qwen2.5:3b)
   * @param {number} [options.contextLength] - Context window tokens (`num_ctx`, defaults to 8192)
   * @param {number} [options.timeoutMs] - Per-request timeout in milliseconds (defaults to 120000)
   */
  constructor(options = {}) {
    const rawBaseUrl =
      options.baseUrl || (env.ollama && env.ollama.baseUrl) || DEFAULT_OLLAMA_BASE_URL;
    const configuredModel =
      options.defaultModel || (env.ollama && env.ollama.model) || DEFAULT_OLLAMA_MODEL;
    const configuredCtx =
      options.contextLength ||
      (env.ollama && env.ollama.contextLength) ||
      DEFAULT_OLLAMA_CONTEXT_LENGTH;

    const cleanBaseUrl = String(rawBaseUrl).trim().replace(/\/+$/, '');
    OllamaProvider.assertLocalUrl(cleanBaseUrl);

    super('ollama', true, configuredModel);

    this.baseUrl = cleanBaseUrl;
    this.contextLength = Number(configuredCtx) || DEFAULT_OLLAMA_CONTEXT_LENGTH;
    this.requestTimeoutMs =
      options.timeoutMs || env.aiRequestTimeoutMs || 120000;
    this.executionEnabled = true;
  }

  /**
   * Ensures the Ollama base URL points exclusively to a local loopback address
   * so policy text can never be transmitted off the user's machine.
   *
   * @param {string} urlString
   */
  static assertLocalUrl(urlString) {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch (_err) {
      const err = new Error(`[ollama] Invalid Ollama base URL: '${urlString}'.`);
      err.code = 'INVALID_OLLAMA_URL';
      err.statusCode = 400;
      throw err;
    }

    if (!LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      const err = new Error(
        `[ollama] Security restriction: Ollama baseUrl must be a local loopback address (localhost or 127.0.0.1), received '${parsed.hostname}'.`
      );
      err.code = 'LOCAL_ONLY_VIOLATION';
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Strips optional markdown code fences if a model wraps JSON in ```json ... ```.
   *
   * @param {string} rawText
   * @returns {string}
   */
  static stripJsonCodeFences(rawText) {
    const trimmed = rawText.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
  }

  /**
   * Returns provider status metadata including local baseUrl and contextLength.
   */
  getStatus() {
    return {
      ...super.getStatus(),
      baseUrl: this.baseUrl,
      contextLength: this.contextLength,
      localOnly: true
    };
  }

  /**
   * Probes the local Ollama service (`GET /api/tags` and `GET /api/ps`) to verify
   * daemon reachability, installed models, and active GPU memory allocation.
   *
   * @returns {Promise<{
   *   reachable: boolean,
   *   baseUrl: string,
   *   defaultModel: string,
   *   contextLength: number,
   *   modelInstalled: boolean,
   *   installedModels: string[],
   *   runningModels: Array<Object>,
   *   error?: string
   * }>}
   */
  async checkHealth() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const [tagsRes, psRes] = await Promise.all([
        fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal }),
        fetch(`${this.baseUrl}/api/ps`, { signal: controller.signal }).catch(() => null)
      ]);

      if (!tagsRes.ok) {
        return {
          reachable: false,
          baseUrl: this.baseUrl,
          defaultModel: this.defaultModel,
          contextLength: this.contextLength,
          modelInstalled: false,
          installedModels: [],
          runningModels: [],
          error: `Ollama /api/tags returned HTTP ${tagsRes.status}`
        };
      }

      const tagsData = await tagsRes.json();
      const installedModels = Array.isArray(tagsData.models)
        ? tagsData.models.map((m) => m.name || m.model).filter(Boolean)
        : [];

      const targetLower = this.defaultModel.toLowerCase();
      const modelInstalled = installedModels.some((m) => {
        const lower = m.toLowerCase();
        return lower === targetLower || lower.startsWith(`${targetLower}:`);
      });

      let runningModels = [];
      if (psRes && psRes.ok) {
        const psData = await psRes.json().catch(() => ({}));
        if (Array.isArray(psData.models)) {
          runningModels = psData.models.map((rm) => ({
            name: rm.name || rm.model,
            sizeBytes: rm.size || null,
            sizeVramBytes: rm.size_vram || null,
            gpuPercent:
              typeof rm.size === 'number' && rm.size > 0 && typeof rm.size_vram === 'number'
                ? Math.round((rm.size_vram / rm.size) * 100)
                : null,
            contextLength: rm.context_length || null
          }));
        }
      }

      return {
        reachable: true,
        baseUrl: this.baseUrl,
        defaultModel: this.defaultModel,
        contextLength: this.contextLength,
        modelInstalled,
        installedModels,
        runningModels
      };
    } catch (err) {
      return {
        reachable: false,
        baseUrl: this.baseUrl,
        defaultModel: this.defaultModel,
        contextLength: this.contextLength,
        modelInstalled: false,
        installedModels: [],
        runningModels: [],
        error: err.message || 'Could not connect to local Ollama service.'
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Executes a single chat completion against local Ollama (`POST /api/chat`).
   *
   * @param {Object} params
   * @param {string} [params.systemPrompt=''] - Optional system instruction
   * @param {string} params.userPrompt - Required user prompt
   * @param {boolean} [params.jsonMode=false] - Whether to request JSON output
   * @param {Object|null} [params.jsonSchema=null] - Optional JSON Schema for Ollama structured outputs
   * @param {number} [params.temperature=0] - Sampling temperature (defaults to 0)
   * @param {string} [params.model] - Optional model override
   * @param {number} [params.contextLength] - Optional `num_ctx` override
   * @param {number} [params.timeoutMs] - Optional request timeout in milliseconds
   * @returns {Promise<{
   *   provider: string,
   *   model: string,
   *   text: string,
   *   usage: {
   *     promptTokens: number | null,
   *     completionTokens: number | null,
   *     thoughtsTokens: number | null,
   *     totalTokens: number | null
   *   },
   *   durationMs: number,
   *   metadata: Object
   * }>}
   */
  async complete(params = {}) {
    const {
      systemPrompt = '',
      userPrompt,
      jsonMode = false,
      jsonSchema = null,
      temperature = 0,
      model,
      contextLength,
      timeoutMs
    } = params;

    if (typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
      const error = new Error('[ollama] A non-empty userPrompt string is required.');
      error.code = 'INVALID_PROMPT_INPUT';
      error.statusCode = 400;
      throw error;
    }

    if (
      typeof temperature !== 'number' ||
      Number.isNaN(temperature) ||
      temperature < 0 ||
      temperature > 2
    ) {
      const error = new Error('[ollama] temperature must be a valid number between 0 and 2.');
      error.code = 'INVALID_TEMPERATURE';
      error.statusCode = 400;
      throw error;
    }

    const targetModel =
      typeof model === 'string' && model.trim().length > 0
        ? model.trim()
        : this.defaultModel;

    const effectiveContextLength =
      typeof contextLength === 'number' && contextLength >= 1024
        ? Math.floor(contextLength)
        : this.contextLength;

    const effectiveTimeoutMs =
      typeof timeoutMs === 'number' && timeoutMs > 0
        ? timeoutMs
        : this.requestTimeoutMs;

    // Pre-flight context capacity check:
    // Refuse to silently truncate when input characters exceed safe token capacity
    const totalInputChars =
      (typeof systemPrompt === 'string' ? systemPrompt.length : 0) + userPrompt.length;
    const estimatedMinPromptTokens = Math.ceil(totalInputChars / 3.8);
    const maxSafePromptTokens = effectiveContextLength - 512;

    if (estimatedMinPromptTokens > maxSafePromptTokens) {
      const ctxErr = new Error(
        `[ollama] Input prompt (~${estimatedMinPromptTokens.toLocaleString()} estimated tokens from ${totalInputChars.toLocaleString()} chars) exceeds the configured local context window (${effectiveContextLength.toLocaleString()} tokens, max safe input ${maxSafePromptTokens.toLocaleString()} tokens). Refusing to silently truncate policy text.`
      );
      ctxErr.code = 'CONTEXT_LENGTH_EXCEEDED';
      ctxErr.statusCode = 413;
      throw ctxErr;
    }

    const messages = [];
    if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      messages.push({
        role: 'system',
        content: systemPrompt.trim()
      });
    }
    messages.push({
      role: 'user',
      content: userPrompt
    });

    const requestBody = {
      model: targetModel,
      stream: false,
      messages,
      options: {
        temperature,
        num_ctx: effectiveContextLength
      }
    };

    if (jsonSchema && typeof jsonSchema === 'object') {
      requestBody.format = jsonSchema;
    } else if (jsonMode) {
      requestBody.format = 'json';
    }

    const abortController = new AbortController();
    let timeoutHandle = null;
    const startTime = Date.now();

    try {
      timeoutHandle = setTimeout(() => {
        abortController.abort();
      }, effectiveTimeoutMs);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      });

      const durationMs = Date.now() - startTime;

      let data = null;
      try {
        data = await response.json();
      } catch (_parseErr) {
        data = null;
      }

      if (!response.ok) {
        const errMsg =
          data && typeof data.error === 'string'
            ? data.error
            : `HTTP ${response.status} ${response.statusText}`;

        if (response.status === 404 || /model.*not found/i.test(errMsg)) {
          const notFoundErr = new Error(
            `[ollama] Model '${targetModel}' was not found in local Ollama (${errMsg}). Run 'ollama pull ${targetModel}' to install it.`
          );
          notFoundErr.code = 'OLLAMA_MODEL_NOT_FOUND';
          notFoundErr.statusCode = 404;
          throw notFoundErr;
        }

        const httpErr = new Error(`[ollama] Local Ollama request failed: ${errMsg}`);
        httpErr.code = 'OLLAMA_API_ERROR';
        httpErr.statusCode =
          response.status >= 400 && response.status < 600 ? response.status : 502;
        throw httpErr;
      }

      if (!data || typeof data !== 'object') {
        const emptyObjErr = new Error('[ollama] Received an empty or invalid response from Ollama.');
        emptyObjErr.code = 'EMPTY_MODEL_RESPONSE';
        emptyObjErr.statusCode = 502;
        throw emptyObjErr;
      }

      const promptTokens =
        typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : null;
      const completionTokens =
        typeof data.eval_count === 'number' ? data.eval_count : null;
      const totalTokens =
        typeof promptTokens === 'number' && typeof completionTokens === 'number'
          ? promptTokens + completionTokens
          : null;

      // Check whether Ollama hit the context window limit during generation
      if (
        data.done_reason === 'length' ||
        (typeof totalTokens === 'number' && totalTokens >= effectiveContextLength)
      ) {
        const lenErr = new Error(
          `[ollama] Generation exceeded the ${effectiveContextLength}-token context window (promptTokens=${promptTokens ?? 'N/A'}, completionTokens=${completionTokens ?? 'N/A'}, doneReason=${data.done_reason || 'length'}).`
        );
        lenErr.code = 'CONTEXT_LENGTH_EXCEEDED';
        lenErr.statusCode = 413;
        throw lenErr;
      }

      const rawText =
        data.message && typeof data.message.content === 'string'
          ? data.message.content.trim()
          : '';

      if (!rawText) {
        const noTextErr = new Error(
          `[ollama] Ollama returned an empty message content (doneReason: ${data.done_reason || 'UNKNOWN'}).`
        );
        noTextErr.code = 'EMPTY_MODEL_RESPONSE';
        noTextErr.statusCode = 502;
        throw noTextErr;
      }

      let finalText = rawText;
      if (jsonMode || jsonSchema) {
        finalText = OllamaProvider.stripJsonCodeFences(rawText);
        try {
          JSON.parse(finalText);
        } catch (_jsonErr) {
          const malformedErr = new Error(
            '[ollama] Model response in jsonMode was not valid JSON.'
          );
          malformedErr.code = 'MALFORMED_JSON_RESPONSE';
          malformedErr.statusCode = 502;
          throw malformedErr;
        }
      }

      return {
        provider: this.providerName,
        model: data.model || targetModel,
        text: finalText,
        usage: {
          promptTokens,
          completionTokens,
          thoughtsTokens: null,
          totalTokens
        },
        durationMs,
        metadata: {
          requestedModel: targetModel,
          modelVersion: data.model || targetModel,
          contextLength: effectiveContextLength,
          doneReason: data.done_reason || 'stop',
          totalDurationNs: typeof data.total_duration === 'number' ? data.total_duration : null,
          loadDurationNs: typeof data.load_duration === 'number' ? data.load_duration : null,
          promptEvalDurationNs:
            typeof data.prompt_eval_duration === 'number' ? data.prompt_eval_duration : null,
          evalDurationNs: typeof data.eval_duration === 'number' ? data.eval_duration : null,
          jsonMode: Boolean(jsonMode || jsonSchema),
          temperature,
          localInference: true
        }
      };
    } catch (err) {
      if (abortController.signal.aborted || err?.name === 'AbortError') {
        const timeoutErr = new Error(
          `[ollama] Local Ollama request timed out after ${effectiveTimeoutMs}ms.`
        );
        timeoutErr.code = 'AI_REQUEST_TIMEOUT';
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      if (
        err?.code &&
        [
          'INVALID_PROMPT_INPUT',
          'INVALID_TEMPERATURE',
          'CONTEXT_LENGTH_EXCEEDED',
          'OLLAMA_MODEL_NOT_FOUND',
          'OLLAMA_API_ERROR',
          'EMPTY_MODEL_RESPONSE',
          'MALFORMED_JSON_RESPONSE',
          'LOCAL_ONLY_VIOLATION',
          'INVALID_OLLAMA_URL'
        ].includes(err.code)
      ) {
        throw err;
      }

      // Network / connection refused errors when Ollama daemon is not running
      const rawMsg = err?.cause?.message || err?.message || String(err);
      if (
        /ECONNREFUSED|ENOTFOUND|fetch failed|connect/i.test(rawMsg) ||
        err?.cause?.code === 'ECONNREFUSED'
      ) {
        const unavailableErr = new Error(
          `[ollama] Could not connect to local Ollama service at ${this.baseUrl}. Please ensure Ollama is running locally ('ollama serve').`
        );
        unavailableErr.code = 'OLLAMA_UNAVAILABLE';
        unavailableErr.statusCode = 503;
        throw unavailableErr;
      }

      const safeMessage = this.sanitizeErrorMessage(rawMsg);
      const wrappedError = new Error(`[ollama] Ollama request failed: ${safeMessage}`);
      wrappedError.code = err?.code || 'OLLAMA_API_ERROR';
      wrappedError.statusCode = 502;
      throw wrappedError;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

module.exports = OllamaProvider;
