//  Application bootstrap - The Clarity Bridge

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet'; // Change to default import
import cookieParser from 'cookie-parser'; // Change to default import
import { AppModule } from './app.module';
import { PrismaService } from '@core/database';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true, // Needed for webhook signature verification
  });

  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  app.enableCors({
    origin: configService.get('app.clientUrl'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Requested-With'],
  });

  // Cookie parser
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // Global prefix
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/(.*)', 'webhooks/(.*)'],
  });

  // Swagger documentation
  if (configService.get('app.env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('The Clarity Bridge API')
      .setDescription('AI-powered specification generator API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('teams', 'Team management')
      .addTag('specifications', 'Specification management')
      .addTag('collaboration', 'Collaboration features')
      .addTag('integrations', 'External integrations')
      .addTag('usage', 'Usage tracking and limits')
      .addTag('payments', 'Subscription and billing')
      .addTag('health', 'Health checks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // Trust proxy for production
  if (configService.get('app.env') === 'production') {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await app.close();
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');
    await app.close();
  });

  // Start server
  const port = configService.get('app.port');
  await app.listen(port);

  console.log(`
    🚀 The Clarity Bridge is running!

    🌍 Environment: ${configService.get('app.env')}
    📡 API URL: ${configService.get('app.url')}
    📚 API Docs: ${configService.get('app.url')}/api/docs
    🔌 WebSocket: ${configService.get('app.url')}/realtime

    Ready to bridge the gap between ideas and implementation! 🌉
  `);
}

bootstrap().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

// ============================================
