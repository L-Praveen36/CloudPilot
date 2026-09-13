import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';
import { AuthModule } from './auth/auth.module';
import { GitHubModule } from './github/github.module';
import { ProjectsModule } from './projects/projects.module';
import { RepositoryIntelligenceModule } from './repository-intelligence/repository-intelligence.module';
import { DeploymentModule } from './deployment/deployment.module';
import { ObservabilityModule } from './observability/observability.module';
import { AiModule } from './ai/ai.module';
import { CicdModule } from './cicd/cicd.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env.local'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env.local'),
        path.resolve(process.cwd(), '../../.env'),
      ],
    }),
    // Rate limiting: 60 requests per minute globally.
    // Expensive endpoints (AI) apply stricter per-route @Throttle().
    // Health and webhook endpoints use @SkipThrottle().
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '60', 10),
      },
    ]),
    PrismaModule,
    SecurityModule,
    AuthModule,
    GitHubModule,
    ProjectsModule,
    RepositoryIntelligenceModule,
    DeploymentModule,
    ObservabilityModule,
    AiModule,
    CicdModule,
    HealthModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally — all routes are rate-limited by default.
    // Individual routes may use @SkipThrottle() or @Throttle() to override.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
