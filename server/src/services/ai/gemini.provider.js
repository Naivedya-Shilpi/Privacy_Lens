const { GoogleGenAI } = require('@google/genai');
const BaseAIProvider = require('./provider-interface');
const env = require('../../config/env');

/**
 * Google Gemini Provider Adapter Foundation
 * Uses the official `@google/genai` SDK. Does not perform network calls during setup.
 */
class GeminiProvider extends BaseAIProvider {
  constructor() {
    super('gemini', env.providers.geminiConfigured);
    this.sdkPackage = '@google/genai';
    this.client = null;

    if (this.isConfigured) {
      this.client = new GoogleGenAI({
        apiKey: env.secrets.geminiApiKey
      });
    }
  }
}

module.exports = GeminiProvider;
