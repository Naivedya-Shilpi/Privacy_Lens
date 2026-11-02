const OpenAI = require('openai');
const BaseAIProvider = require('./provider-interface');
const env = require('../../config/env');

/**
 * OpenAI (ChatGPT) Provider Adapter Foundation
 * Uses the official `openai` SDK. Does not perform network calls during setup.
 */
class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super('openai', env.providers.openaiConfigured);
    this.sdkPackage = 'openai';
    this.client = null;

    if (this.isConfigured) {
      this.client = new OpenAI({
        apiKey: env.secrets.openaiApiKey
      });
    }
  }
}

module.exports = OpenAIProvider;
