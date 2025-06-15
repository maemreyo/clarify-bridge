//  Environment variables validation schema

import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().uri().required(),
  CLIENT_URL: Joi.string().uri().required(),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),

  // Authentication
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('1d'),
  REFRESH_EXPIRATION: Joi.string().default('7d'),

  // AI Providers (at least one required)
  OPENAI_API_KEY: Joi.string().optional(),
  GOOGLE_AI_API_KEY: Joi.string().optional(),
  ANTHROPIC_API_KEY: Joi.string().optional(),

  // Vector Database
  VECTOR_DB_PROVIDER: Joi.string().valid('pinecone', 'chroma').default('pinecone'),
  PINECONE_API_KEY: Joi.when('VECTOR_DB_PROVIDER', {
    is: 'pinecone',
    then: Joi.string().required(),
  }),
  PINECONE_ENVIRONMENT: Joi.when('VECTOR_DB_PROVIDER', {
    is: 'pinecone',
    then: Joi.string().required(),
  }),
  PINECONE_INDEX: Joi.when('VECTOR_DB_PROVIDER', {
    is: 'pinecone',
    then: Joi.string().required(),
  }),

  // Payment
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),

  // Email
  EMAIL_FROM: Joi.string().email().default('noreply@claritybridge.ai'),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
}).unknown(); // Allow additional env vars

// ============================================
