/**
 * PrivacyLens - Provider-Independent AI Service Interface
 *
 * Defines the standard contract that all AI model adapters (OpenAI, Gemini, Claude)
 * must implement so prompt engineering strategies (V1, V2, V3) can be evaluated
 * identically across providers without changing application logic.
 *
 * NOTE: No live API calls are executed during the initial project setup phase.
 */

class BaseAIProvider {
  /**
   * @param {string} providerName - Identifier for the AI provider ('openai' | 'gemini' | 'claude')
   * @param {boolean} isConfigured - Whether the corresponding API key is present in .env
   */
  constructor(providerName, isConfigured = false) {
    if (new.target === BaseAIProvider) {
      throw new Error('BaseAIProvider is an abstract interface and cannot be instantiated directly.');
    }
    this.providerName = providerName;
    this.isConfigured = Boolean(isConfigured);
  }

  /**
   * Returns metadata about the provider's readiness without exposing keys.
   */
  getStatus() {
    return {
      provider: this.providerName,
      configured: this.isConfigured,
      readyForAnalysis: false,
      phase: 'initialization_only'
    };
  }

  /**
   * Placeholder contract for executing a prompt against untrusted policy text.
   * To be implemented in the AI integration phase.
   *
   * @param {Object} _params
   * @param {string} _params.systemPrompt
   * @param {string} _params.policyText
   * @param {Object} [_params.options]
   * @returns {Promise<Object>}
   */
  async generatePolicyAnalysis(_params) {
    throw new Error(
      `[${this.providerName}] Live AI policy analysis is not enabled during the project initialization phase.`
    );
  }
}

module.exports = BaseAIProvider;
