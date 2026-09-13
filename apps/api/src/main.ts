import * as path from 'path';
import * as dotenv from 'dotenv';

// Pre-load environment variables from .env files before NestJS bootstrap
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../.env.local'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath });
}

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// ---------------------------------------------------------------------------
// Startup Configuration Validation
// Fail fast if critical environment variables are missing or malformed.
// This prevents the application from starting in a misconfigured state that
// could lead to silent security failures (e.g. bad encryption key).
// ---------------------------------------------------------------------------
function validateStartupConfig(logger: Logger): void {
  const errors: string[] = [];

  const encKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!encKey) {
    errors.push('GITHUB_TOKEN_ENCRYPTION_KEY is not set');
  } else if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    errors.push('GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is not set');
  }

  if (!process.env.GITHUB_CLIENT_ID) {
    logger.warn('⚠️  GITHUB_CLIENT_ID is not set — GitHub OAuth will not work');
  }

  if (!process.env.GITHUB_CLIENT_SECRET) {
    logger.warn('⚠️  GITHUB_CLIENT_SECRET is not set — GitHub OAuth will not work');
  }

  if (errors.length > 0) {
    for (const err of errors) {
      logger.error(`❌ Configuration error: ${err}`);
    }
    logger.error('Aborting startup due to critical configuration errors.');
    process.exit(1);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate critical config before creating the NestJS application.
  validateStartupConfig(logger);

  const nodeEnv = process.env.NODE_ENV || 'development';
  logger.log(`🌍 NODE_ENV: ${nodeEnv}`);
  logger.log(`✅ Configuration validated successfully`);

  const app = await NestFactory.create(AppModule);

  // Security: HTTP security headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // API — no HTML served; CSP not applicable
      crossOriginEmbedderPolicy: false, // Allow frontend cross-origin embedding
    }),
  );

  // Register cookie-parser middleware for session and state handling
  app.use(cookieParser());

  // Global exception filters (registered in order: most specific first)
  // AllExceptionsFilter MUST be registered before HttpExceptionFilter so that
  // NestJS applies HttpExceptionFilter first (LIFO for filters).
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // Global validation pipe for strict parameter and query validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const isProduction = nodeEnv === 'production';

  // In production, only allow the configured FRONTEND_URL.
  // In development, also allow localhost variants for convenience.
  const allowedOrigins = isProduction
    ? [frontendUrl]
    : [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 CloudPilot API is running on: http://localhost:${port}`);
  logger.log(`🩺 Health check endpoint: http://localhost:${port}/health`);
  logger.log(`🔐 GitHub OAuth entry point: http://localhost:${port}/auth/github`);
  logger.log(`🛡️  Security headers: helmet enabled`);
  logger.log(`⚡ Rate limiting: ThrottlerModule active`);
}

bootstrap();
