const Anthropic = require('@anthropic-ai/sdk');
const BaseAIProvider = require('./provider-interface');
const env = require('../../config/env');

/**
 * Anthropic (Claude) Provider Adapter Foundation
 * Uses the official `@anthropic-ai/sdk` package. Does not perform network calls during setup.
 */
class ClaudeProvider extends BaseAIProvider {
  constructor() {
    super('claude', env.providers.anthropicConfigured);
    this.sdkPackage = '@anthropic-ai/sdk';
    this.client = null;

    if (this.isConfigured) {
      this.client = new Anthropic({
        apiKey: env.secrets.anthropicApiKey
      });
    }
  }
}

module.exports = ClaudeProvider;
