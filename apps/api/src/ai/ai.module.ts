import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MockAiProvider } from './providers/mock-ai.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { AiProviderFactory } from './providers/ai-provider.factory';
import { AiContextSanitizerService } from './services/ai-context-sanitizer.service';
import { AiRepoUnderstandingService } from './services/ai-repo-understanding.service';
import { AiDeploymentGeneratorService } from './services/ai-deployment-generator.service';
import { AiFailureDiagnosisService } from './services/ai-failure-diagnosis.service';
import { AiRepairSuggestionService } from './services/ai-repair-suggestion.service';
import { AiAgentService } from './services/ai-agent.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    ObservabilityModule,
  ],
  controllers: [AiController],
  providers: [
    MockAiProvider,
    OpenAiCompatibleProvider,
    AiProviderFactory,
    AiContextSanitizerService,
    AiRepoUnderstandingService,
    AiDeploymentGeneratorService,
    AiFailureDiagnosisService,
    AiRepairSuggestionService,
    AiAgentService,
    AiService,
  ],
  exports: [
    AiService,
    AiContextSanitizerService,
    AiAgentService,
  ],
})
export class AiModule {}
