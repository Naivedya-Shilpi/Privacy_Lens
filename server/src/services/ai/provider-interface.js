/**
 * PrivacyLens - Provider-Independent AI Service Interface
 *
 * Defines the standard contract that all AI model adapters (OpenAI, Gemini, Claude)
 * must implement so prompt engineering strategies (V1, V2, V3) can be evaluated
 * identically across providers without changing application logic.
 */

class BaseAIProvider {
  /**
   * @param {string} providerName - Identifier for the AI provider ('openai' | 'gemini' | 'claude')
   * @param {boolean} isConfigured - Whether the corresponding API key is present in .env
   * @param {string|null} [defaultModel=null] - Default model identifier for this provider
   */
  constructor(providerName, isConfigured = false, defaultModel = null) {
    if (new.target === BaseAIProvider) {
      throw new Error('BaseAIProvider is an abstract interface and cannot be instantiated directly.');
    }
    this.providerName = providerName;
    this.isConfigured = Boolean(isConfigured);
    this.defaultModel = defaultModel;
    this.executionEnabled = false;
  }

  /**
   * Returns metadata about the provider's readiness without exposing keys.
   */
  getStatus() {
    const ready = Boolean(this.isConfigured && this.executionEnabled);
    return {
      provider: this.providerName,
      configured: this.isConfigured,
      readyForAnalysis: ready,
      defaultModel: this.defaultModel,
      phase: ready ? 'active' : 'initialization_only'
    };
  }

  /**
   * Sanitizes error messages so secret keys or query tokens are never exposed in logs or responses.
   *
   * @param {string} message - Raw error message
   * @param {string[]} [secretsToRedact=[]] - Any secret strings to strip if present
   * @returns {string}
   */
  sanitizeErrorMessage(message, secretsToRedact = []) {
    if (typeof message !== 'string' || message.length === 0) {
      return 'An unexpected AI provider error occurred.';
    }

    let safeMessage = message
      .replace(/key=[A-Za-z0-9_\-]+/gi, 'key=[REDACTED]')
      .replace(/AIza[A-Za-z0-9_\-]{10,}/g, '[REDACTED_API_KEY]')
      .replace(/sk-[A-Za-z0-9_\-]{10,}/g, '[REDACTED_API_KEY]');

    for (const secret of secretsToRedact) {
      if (typeof secret === 'string' && secret.trim().length > 0) {
        safeMessage = safeMessage.split(secret.trim()).join('[REDACTED_API_KEY]');
      }
    }

    return safeMessage;
  }

  /**
   * Executes a single prompt completion against the AI provider.
   *
   * @param {Object} params
   * @param {string} [params.systemPrompt=''] - System instructions steering model behavior
   * @param {string} params.userPrompt - User prompt content
   * @param {boolean} [params.jsonMode=false] - Whether to request structured JSON output
   * @param {number} [params.temperature=0] - Sampling temperature (0 = deterministic)
   * @param {string} [params.model] - Optional model override
   * @param {number} [params.timeoutMs] - Optional timeout in milliseconds
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
  async complete(_params) {
    const error = new Error(
      `[${this.providerName}] Live AI completion is not implemented for this provider yet.`
    );
    error.code = 'PROVIDER_NOT_IMPLEMENTED';
    error.statusCode = 501;
    throw error;
  }

  /**
   * Executes a single-pass policy analysis using complete() when supported by the provider.
   *
   * @param {Object} params
   * @param {string} [params.systemPrompt='']
   * @param {string} params.policyText
   * @param {Object} [params.options={}]
   * @returns {Promise<Object>}
   */
  async generatePolicyAnalysis(params = {}) {
    if (!this.executionEnabled) {
      const error = new Error(
        `[${this.providerName}] Live AI policy analysis is not enabled during the project initialization phase.`
      );
      error.code = 'PROVIDER_NOT_IMPLEMENTED';
      error.statusCode = 501;
      throw error;
    }

    const { systemPrompt = '', policyText, options = {} } = params;
    return this.complete({
      systemPrompt,
      userPrompt: policyText,
      jsonMode: Boolean(options.jsonMode),
      temperature: typeof options.temperature === 'number' ? options.temperature : 0,
      model: options.model,
      timeoutMs: options.timeoutMs
    });
  }
}

module.exports = BaseAIProvider;
