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
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.string().transform(Number).default(6379),
  REDIS_PASSWORD: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const message = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

module.exports = parsed.data;


