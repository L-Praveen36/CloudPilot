import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RepositoryIntelligenceController } from './repository-intelligence.controller';
import { RepositoryIntelligenceService } from './repository-intelligence.service';
import { RepositoryAnalyzerService } from './services/repository-analyzer.service';
import { RepositorySourceService } from './services/repository-source.service';
import { ApplicationStructureService } from './services/application-structure.service';
import { DeploymentReadinessService } from './services/deployment-readiness.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GitHubModule } from '../github/github.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, GitHubModule],
  controllers: [RepositoryIntelligenceController],
  providers: [
    RepositoryIntelligenceService,
    RepositoryAnalyzerService,
    RepositorySourceService,
    ApplicationStructureService,
    DeploymentReadinessService,
  ],
  exports: [
    RepositoryIntelligenceService,
    RepositoryAnalyzerService,
    RepositorySourceService,
    ApplicationStructureService,
    DeploymentReadinessService,
  ],
})
export class RepositoryIntelligenceModule {}
