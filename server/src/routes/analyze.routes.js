const express = require('express');
const { z } = require('zod');
const env = require('../config/env');
const OllamaProvider = require('../services/ai/ollama.provider');
const GeminiProvider = require('../services/ai/gemini.provider');
const { runPromptAnalysis } = require('../services/prompt/prompt-runner');
const { formatSafeValidationIssues } = require('../services/prompt/schemas');

const router = express.Router();

const MIN_POLICY_TEXT_LENGTH = 40;
const MAX_POLICY_TEXT_LENGTH = 60000;
const ROUTE_SOCKET_TIMEOUT_MS = 240000; // 4 minutes (supports up to 4 sequential 60s stages)

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 15; // 15 requests per 10 minutes per IP

/**
 * Lightweight in-memory IP rate limiter for `/api/analyze`.
 * Protects the single-instance prototype from accidental or automated API quota exhaustion.
 */
const ipRequestBuckets = new Map();

function analyzeRateLimiter(req, res, next) {
  const now = Date.now();
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

  // Periodically prune expired IP buckets to avoid unbounded memory growth
  if (ipRequestBuckets.size > 500) {
    for (const [ipKey, bucket] of ipRequestBuckets.entries()) {
      if (now >= bucket.resetAt) {
        ipRequestBuckets.delete(ipKey);
      }
    }
  }

  let bucket = ipRequestBuckets.get(clientIp);
  if (!bucket || now >= bucket.resetAt) {
    bucket = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    };
    ipRequestBuckets.set(clientIp, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - bucket.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      application: 'PrivacyLens',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} analysis requests allowed per 10 minutes. Please retry in ${retryAfterSeconds} seconds.`,
        retryAfterSeconds
      },
      timestamp: new Date().toISOString()
    });
  }

  return next();
}

/**
 * Resets the in-memory rate-limit counters (exported for isolated deterministic testing).
 */
function resetAnalyzeRateLimiter() {
  ipRequestBuckets.clear();
}

/**
 * Zod Request Validation Schema for `POST /api/analyze`
 * - Does not silently truncate policyText.
 * - Never echoes raw policyText in validation error messages.
 */
const analyzeRequestSchema = z
  .object({
    policyText: z
      .string({
        required_error: 'policyText is required.',
        invalid_type_error: 'policyText must be a string.'
      })
      .superRefine((val, ctx) => {
        const trimmed = val.trim();
        if (trimmed.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'policyText cannot be empty or whitespace only.'
          });
          return;
        }
        if (trimmed.length < MIN_POLICY_TEXT_LENGTH) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `policyText must be at least ${MIN_POLICY_TEXT_LENGTH} characters long (received ${trimmed.length} characters).`
          });
        }
        if (val.length > MAX_POLICY_TEXT_LENGTH) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `policyText exceeds the maximum allowed length of ${MAX_POLICY_TEXT_LENGTH} characters (received ${val.length} characters). Input is not silently truncated.`
          });
        }
      }),
    promptVersion: z
      .string({
        invalid_type_error: 'promptVersion must be a string.'
      })
      .trim()
      .toLowerCase()
      .refine((val) => ['v1', 'v2', 'v3'].includes(val), {
        message: "Unsupported promptVersion. Allowed values are 'v1', 'v2', or 'v3'."
      })
      .optional()
      .default('v3'),
    provider: z
      .string({
        invalid_type_error: 'provider must be a string.'
      })
      .trim()
      .toLowerCase()
      .refine((val) => ['ollama', 'gemini', 'openai', 'claude'].includes(val), {
        message:
          "Unsupported provider. Allowed values are 'ollama' (default), 'gemini', 'openai', or 'claude'."
      })
      .optional()
      .default('ollama'),
    pageMetadata: z
      .object(
        {
          title: z.string().trim().max(500, 'pageMetadata.title must not exceed 500 characters.').optional(),
          url: z.string().trim().max(2048, 'pageMetadata.url must not exceed 2048 characters.').optional()
        },
        {
          invalid_type_error: 'pageMetadata must be an object.'
        }
      )
      .optional()
  })
  .strict();

/**
 * POST /api/analyze
 * Validates policy input, executes V1/V2/V3 prompt orchestration, and returns structured analysis.
 */
router.post('/analyze', analyzeRateLimiter, async (req, res) => {
  // Extend socket timeout for multi-stage V2 (3 calls) and V3 (4 calls) executions
  req.setTimeout(ROUTE_SOCKET_TIMEOUT_MS);
  res.setTimeout(ROUTE_SOCKET_TIMEOUT_MS);

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      application: 'PrivacyLens',
      error: {
        code: 'INVALID_REQUEST_BODY',
        message: 'Request body must be a valid JSON object.'
      },
      timestamp: new Date().toISOString()
    });
  }

  const parsedReq = analyzeRequestSchema.safeParse(req.body);

  if (!parsedReq.success) {
    const fieldErrors = formatSafeValidationIssues(parsedReq.error);
    const hasPromptVersionErr = fieldErrors.some((issue) => issue.path === 'promptVersion');
    const hasProviderErr = fieldErrors.some((issue) => issue.path === 'provider');

    let errorCode = 'INVALID_REQUEST_BODY';
    if (hasPromptVersionErr) {
      errorCode = 'UNSUPPORTED_PROMPT_VERSION';
    } else if (hasProviderErr) {
      errorCode = 'UNSUPPORTED_PROVIDER';
    }

    return res.status(400).json({
      success: false,
      application: 'PrivacyLens',
      error: {
        code: errorCode,
        message: fieldErrors[0]?.message || 'Request validation failed.',
        fieldErrors
      },
      timestamp: new Date().toISOString()
    });
  }

  const { policyText, promptVersion, provider, pageMetadata } = parsedReq.data;

  // Check provider implementation & configuration status
  // Strict Local-First Policy: NEVER silently fall back from Ollama to Gemini
  if (provider === 'openai' || provider === 'claude') {
    return res.status(503).json({
      success: false,
      application: 'PrivacyLens',
      error: {
        code: 'PROVIDER_NOT_IMPLEMENTED',
        message: `AI provider '${provider}' is not enabled in this milestone. Supported active providers are 'ollama' (local default) and 'gemini' (manual fallback).`
      },
      timestamp: new Date().toISOString()
    });
  }

  let activeProviderInstance;

  if (provider === 'gemini') {
    if (!env.providers.geminiConfigured) {
      return res.status(503).json({
        success: false,
        application: 'PrivacyLens',
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message:
            'Gemini provider is not configured on the server. Set GEMINI_API_KEY in server/.env, or use the default local Ollama provider.'
        },
        timestamp: new Date().toISOString()
      });
    }
    activeProviderInstance = new GeminiProvider();
  } else {
    activeProviderInstance = new OllamaProvider();
  }

  const requestStartTime = Date.now();

  try {
    const result = await runPromptAnalysis({
      policyText,
      promptVersion,
      provider: activeProviderInstance
    });

    const totalDurationMs = Date.now() - requestStartTime;
    const verificationAudit = result.analysis.verificationAudit;

    return res.status(200).json({
      success: true,
      application: 'PrivacyLens',
      data: {
        analysis: result.analysis,
        rawText: result.rawText,
        promptVersion: result.promptVersion,
        verificationStatus: verificationAudit.verificationStatus,
        verified: verificationAudit.verified,
        provider: result.provider,
        model: result.model,
        durationMs: result.totalDurationMs || totalDurationMs,
        stageCount: result.modelCallCount,
        tokenUsage: {
          promptTokens: result.totalUsage.promptTokens,
          completionTokens: result.totalUsage.completionTokens,
          thoughtsTokens: result.totalUsage.thoughtsTokens,
          totalTokens: result.totalUsage.totalTokens
        },
        stages: result.stages,
        pageMetadata: pageMetadata || null
      }
    });
  } catch (err) {
    const statusCode =
      typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 502;
    const code = err.code || 'ANALYSIS_EXECUTION_FAILED';
    const safeMessage =
      typeof err.message === 'string' && err.message.length > 0
        ? err.message
        : 'An unexpected error occurred while analyzing the privacy policy.';

    console.error(
      `[PrivacyLens Analyze Error] status=${statusCode} code=${code} stage=${err.stage || 'none'}`
    );

    const errorPayload = {
      code,
      message: safeMessage
    };

    if (err.stage) {
      errorPayload.stage = err.stage;
    }
    if (Array.isArray(err.validationIssues) && err.validationIssues.length > 0) {
      errorPayload.validationIssues = err.validationIssues;
    }

    return res.status(statusCode).json({
      success: false,
      application: 'PrivacyLens',
      error: errorPayload,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
module.exports.resetAnalyzeRateLimiter = resetAnalyzeRateLimiter;
module.exports.RATE_LIMIT_MAX_REQUESTS = RATE_LIMIT_MAX_REQUESTS;
