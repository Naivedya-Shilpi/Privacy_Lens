const express = require('express');
const env = require('../config/env');

const router = express.Router();

/**
 * GET /api/health
 * Returns application metadata, server health status, current ISO timestamp,
 * and non-sensitive AI provider configuration readiness.
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    application: 'PrivacyLens',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    version: '0.1.0',
    providersConfigured: env.providers
  });
});

module.exports = router;
