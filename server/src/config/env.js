const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from server/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('localhost'),
  AI_PROVIDER: z.enum(['ollama', 'gemini']).default('ollama'),
  OLLAMA_BASE_URL: z.string().trim().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().trim().min(1).default('qwen2.5:3b'),
  OLLAMA_CONTEXT_LENGTH: z.coerce.number().int().min(2048).max(32768).default(8192),
  OPENAI_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-2.5-flash'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[PrivacyLens] Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

module.exports = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  host: env.HOST,
  defaultProvider: env.AI_PROVIDER,
  aiRequestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
  ollama: {
    baseUrl: env.OLLAMA_BASE_URL.replace(/\/+$/, ''),
    model: env.OLLAMA_MODEL,
    contextLength: env.OLLAMA_CONTEXT_LENGTH
  },
  models: {
    ollama: env.OLLAMA_MODEL,
    gemini: env.GEMINI_MODEL
  },
  providers: {
    defaultProvider: env.AI_PROVIDER,
    ollamaConfigured: Boolean(env.OLLAMA_BASE_URL && env.OLLAMA_MODEL),
    ollamaBaseUrl: env.OLLAMA_BASE_URL.replace(/\/+$/, ''),
    ollamaModel: env.OLLAMA_MODEL,
    ollamaContextLength: env.OLLAMA_CONTEXT_LENGTH,
    openaiConfigured: Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0),
    geminiConfigured: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0),
    anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim().length > 0)
  },
  // Secret keys are kept strictly server-side and never serialized to API responses
  secrets: {
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY
  }
};
