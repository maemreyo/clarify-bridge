//  Application configuration

export default () => ({
  // Application
  app: {
    name: process.env.APP_NAME || 'The Clarity Bridge',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    url: process.env.APP_URL || 'http://localhost:3000',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3001',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiration: process.env.JWT_EXPIRATION || '1d',
    refreshExpiration: process.env.REFRESH_EXPIRATION || '7d',
  },

  // AI Providers
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    },
    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY,
      model: process.env.GOOGLE_AI_MODEL || 'gemini-pro',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
    },
  },

  // Vector Database
  vectorDb: {
    provider: process.env.VECTOR_DB_PROVIDER || 'pinecone',
    pinecone: {
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
      index: process.env.PINECONE_INDEX,
    },
  },

  // Payment
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceIds: {
      starterMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
      starterYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
      proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      proYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
  },

  // Email
  email: {
    from: process.env.EMAIL_FROM || 'noreply@claritybridge.ai',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
  },

  // Rate Limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// ============================================
