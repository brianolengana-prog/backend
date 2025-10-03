const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3001),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  FRONTEND_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('24h'),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // Redis is optional; default to disabled
  REDIS_DISABLED: z.string().optional().default('true'),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().transform(Number).optional().default('6379'),
  REDIS_PASSWORD: z.string().optional()
  ,
  // AI controls: default OFF, only opt-in for reinforcement
  DISABLE_AI: z.string().optional().default('true'),
  AI_ENABLED_FOR_XLSX: z.string().optional().default('false'),
  AI_MAX_CHUNKS: z.string().optional().default('20'),
  AI_CHUNK_SIZE: z.string().optional().default('4000'),
  AI_EARLY_EXIT_ON_ZERO_CONTACTS: z.string().optional().default('true')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const message = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

module.exports = parsed.data;


