const express = require('express');
const env = require('../config/env');
const OllamaProvider = require('../services/ai/ollama.provider');

const router = express.Router();

/**
 * GET /api/health
 * Returns application metadata, server health status, current ISO timestamp,
 * local Ollama readiness (`qwen2.5:3b`), and non-sensitive AI provider configuration flags.
 */
router.get('/health', async (_req, res) => {
  const ollamaProvider = new OllamaProvider();
  const ollamaHealth = await ollamaProvider.checkHealth();

  res.status(200).json({
    success: true,
    application: 'PrivacyLens',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    version: '0.2.0',
    defaultProvider: env.defaultProvider || 'ollama',
    providersConfigured: {
      ...env.providers,
      ollamaReachable: ollamaHealth.reachable,
      ollamaModelInstalled: ollamaHealth.modelInstalled
    },
    ollama: ollamaHealth
  });
});

module.exports = router;
