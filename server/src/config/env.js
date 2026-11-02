const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from server/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('localhost'),
  OPENAI_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default('')
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
  providers: {
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
