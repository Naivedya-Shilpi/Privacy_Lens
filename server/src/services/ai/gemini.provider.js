const { GoogleGenAI } = require('@google/genai');
const BaseAIProvider = require('./provider-interface');
const env = require('../../config/env');

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Google Gemini Provider Adapter
 * Implements live Gemini API execution using the official `@google/genai` SDK.
 */
class GeminiProvider extends BaseAIProvider {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.apiKey] - Optional override (used for unit testing unconfigured states)
   * @param {string} [options.defaultModel] - Optional default model override
   * @param {number} [options.timeoutMs] - Optional request timeout in milliseconds
   */
  constructor(options = {}) {
    const rawKey =
      options.apiKey !== undefined ? options.apiKey : env.secrets.geminiApiKey;
    const isConfigured = Boolean(typeof rawKey === 'string' && rawKey.trim().length > 0);
    const configuredModel =
      options.defaultModel || (env.models && env.models.gemini) || DEFAULT_GEMINI_MODEL;

    super('gemini', isConfigured, configuredModel);

    this.sdkPackage = '@google/genai';
    this.executionEnabled = true;
    this.requestTimeoutMs =
      options.timeoutMs || env.aiRequestTimeoutMs || 60000;
    this.client = null;
    this.#apiKeyRef = isConfigured ? rawKey.trim() : '';

    if (this.isConfigured) {
      this.client = new GoogleGenAI({
        apiKey: this.#apiKeyRef
      });
    }
  }

  #apiKeyRef = '';

  /**
   * Strips optional markdown code fences if a model wraps JSON in ```json ... ```
   * while in JSON mode.
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
   * Sends a completion request to the Google Gemini API using `client.models.generateContent`.
   *
   * @param {Object} params
   * @param {string} [params.systemPrompt=''] - Optional system instruction
   * @param {string} params.userPrompt - Required user prompt text
   * @param {boolean} [params.jsonMode=false] - Whether to enforce JSON output (`application/json`)
   * @param {number} [params.temperature=0] - Sampling temperature (defaults to 0)
   * @param {string} [params.model] - Optional Gemini model override
   * @param {number} [params.timeoutMs] - Optional per-request timeout in ms
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
    if (!this.isConfigured || !this.client) {
      const error = new Error(
        '[gemini] Gemini API key is not configured. Please set GEMINI_API_KEY in server/.env.'
      );
      error.code = 'PROVIDER_NOT_CONFIGURED';
      error.statusCode = 503;
      throw error;
    }

    const {
      systemPrompt = '',
      userPrompt,
      jsonMode = false,
      temperature = 0,
      model,
      timeoutMs
    } = params;

    if (typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
      const error = new Error('[gemini] A non-empty userPrompt string is required.');
      error.code = 'INVALID_PROMPT_INPUT';
      error.statusCode = 400;
      throw error;
    }

    if (typeof temperature !== 'number' || Number.isNaN(temperature) || temperature < 0 || temperature > 2) {
      const error = new Error('[gemini] temperature must be a valid number between 0 and 2.');
      error.code = 'INVALID_TEMPERATURE';
      error.statusCode = 400;
      throw error;
    }

    const targetModel =
      typeof model === 'string' && model.trim().length > 0
        ? model.trim()
        : this.defaultModel;

    const effectiveTimeoutMs =
      typeof timeoutMs === 'number' && timeoutMs > 0
        ? timeoutMs
        : this.requestTimeoutMs;

    const abortController = new AbortController();
    let timeoutHandle = null;

    const config = {
      temperature,
      abortSignal: abortController.signal
    };

    if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      config.systemInstruction = systemPrompt.trim();
    }

    if (jsonMode) {
      config.responseMimeType = 'application/json';
    }

    const startTime = Date.now();

    try {
      timeoutHandle = setTimeout(() => {
        abortController.abort();
      }, effectiveTimeoutMs);

      const response = await this.client.models.generateContent({
        model: targetModel,
        contents: userPrompt,
        config
      });

      const durationMs = Date.now() - startTime;

      if (!response) {
        const emptyErr = new Error('[gemini] Received an empty or null response object from Gemini API.');
        emptyErr.code = 'EMPTY_MODEL_RESPONSE';
        emptyErr.statusCode = 502;
        throw emptyErr;
      }

      if (response.promptFeedback && response.promptFeedback.blockReason) {
        const blockErr = new Error(
          `[gemini] Prompt was blocked by Gemini safety filters (reason: ${response.promptFeedback.blockReason}).`
        );
        blockErr.code = 'PROMPT_BLOCKED';
        blockErr.statusCode = 422;
        throw blockErr;
      }

      const rawText = typeof response.text === 'string' ? response.text.trim() : '';
      const finishReason = response.candidates?.[0]?.finishReason || null;

      if (!rawText) {
        const noTextErr = new Error(
          `[gemini] Gemini returned an empty text completion (finishReason: ${finishReason || 'UNKNOWN'}).`
        );
        noTextErr.code = 'EMPTY_MODEL_RESPONSE';
        noTextErr.statusCode = 502;
        throw noTextErr;
      }

      let finalText = rawText;
      if (jsonMode) {
        finalText = GeminiProvider.stripJsonCodeFences(rawText);
        try {
          JSON.parse(finalText);
        } catch (_jsonErr) {
          const malformedErr = new Error(
            '[gemini] Model response in jsonMode was not valid JSON.'
          );
          malformedErr.code = 'MALFORMED_JSON_RESPONSE';
          malformedErr.statusCode = 502;
          throw malformedErr;
        }
      }

      const usage = response.usageMetadata || {};

      return {
        provider: this.providerName,
        model: response.modelVersion || targetModel,
        text: finalText,
        usage: {
          promptTokens:
            typeof usage.promptTokenCount === 'number' ? usage.promptTokenCount : null,
          completionTokens:
            typeof usage.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null,
          thoughtsTokens:
            typeof usage.thoughtsTokenCount === 'number' ? usage.thoughtsTokenCount : null,
          totalTokens:
            typeof usage.totalTokenCount === 'number' ? usage.totalTokenCount : null
        },
        durationMs,
        metadata: {
          requestedModel: targetModel,
          modelVersion: response.modelVersion || targetModel,
          responseId: response.responseId || null,
          finishReason,
          jsonMode: Boolean(jsonMode),
          temperature
        }
      };
    } catch (err) {
      if (abortController.signal.aborted || err?.name === 'AbortError') {
        const timeoutErr = new Error(
          `[gemini] Gemini API request timed out after ${effectiveTimeoutMs}ms.`
        );
        timeoutErr.code = 'AI_REQUEST_TIMEOUT';
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      if (
        err?.code &&
        [
          'EMPTY_MODEL_RESPONSE',
          'PROMPT_BLOCKED',
          'MALFORMED_JSON_RESPONSE',
          'PROVIDER_NOT_CONFIGURED',
          'INVALID_PROMPT_INPUT',
          'INVALID_TEMPERATURE'
        ].includes(err.code)
      ) {
        throw err;
      }

      const safeMessage = this.sanitizeErrorMessage(err?.message || String(err), [
        this.#apiKeyRef
      ]);
      const wrappedError = new Error(`[gemini] Gemini API request failed: ${safeMessage}`);
      wrappedError.code = err?.code || 'GEMINI_API_ERROR';
      wrappedError.statusCode =
        typeof err?.status === 'number' && err.status >= 400 && err.status < 600
          ? err.status
          : 502;
      throw wrappedError;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

module.exports = GeminiProvider;
