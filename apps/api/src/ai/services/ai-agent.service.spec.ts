import { Test, TestingModule } from '@nestjs/testing';
import { AiAgentService } from './ai-agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible.provider';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { ObservabilityLogService } from '../../observability/services/observability-log.service';
import { ContainerTelemetryService } from '../../observability/services/container-telemetry.service';
import { ObservabilityHealthService } from '../../observability/services/observability-health.service';
import { ConfigService } from '@nestjs/config';

describe('AiAgentService', () => {
  let service: AiAgentService;

  const mockPrisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'proj-123', repositoryName: 'test-repo', userId: 'user-123' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'proj-123', repositoryName: 'test-repo' }),
    },
    deployment: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'dep-123',
        projectId: 'proj-123',
        status: 'FAILED',
        errorMessage: 'SyntaxError in server.js',
        logs: [{ level: 'ERROR', message: 'SyntaxError: Unexpected token' }],
      }),
    },
    repositoryAnalysis: {
      findUnique: jest.fn().mockResolvedValue({
        primaryLanguage: 'TypeScript',
        framework: 'Express',
        packageManager: 'npm',
        projectType: 'STANDALONE',
        isMonorepo: false,
      }),
    },
    deploymentEvent: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    deploymentMetric: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    aiAgentInteraction: {
      create: jest.fn().mockResolvedValue({ id: 'agent-session-1' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAgentService,
        AiContextSanitizerService,
        AiProviderFactory,
        MockAiProvider,
        OpenAiCompatibleProvider,
        {
          provide: ObservabilityLogService,
          useValue: {},
        },
        {
          provide: ContainerTelemetryService,
          useValue: {},
        },
        {
          provide: ObservabilityHealthService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock') },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AiAgentService>(AiAgentService);
  });

  it('should run agent workflow and gather facts using authorized tools', async () => {
    const response = await service.runAgent('user-123', 'proj-123', {
      prompt: 'Why did my latest deployment fail?',
    });

    expect(response).toBeDefined();
    expect(response.toolsUsed.length).toBeGreaterThan(0);
    expect(response.steps.length).toBeGreaterThan(0);
    expect(response.answer).toBeDefined();
    expect(mockPrisma.aiAgentInteraction.create).toHaveBeenCalled();
  });

  it('should fall back gracefully when AI provider throws or times out', async () => {
    const providerFactory = (service as any).providerFactory;
    jest.spyOn(providerFactory, 'getProvider').mockResolvedValueOnce({
      modelIdentifier: 'failing-provider',
      complete: jest.fn().mockRejectedValue(new Error('AI Request Timeout')),
    });

    const response = await service.runAgent('user-123', 'proj-123', {
      prompt: 'Explain failure',
    });

    expect(response).toBeDefined();
    expect(response.answer).toContain('Based on CloudPilot diagnostics');
  });

  it('should fall back to evidence when AI returns empty text', async () => {
    const providerFactory = (service as any).providerFactory;
    jest.spyOn(providerFactory, 'getProvider').mockResolvedValueOnce({
      modelIdentifier: 'empty-provider',
      complete: jest.fn().mockResolvedValue({ text: '', promptTokens: 0, completionTokens: 0 }),
    });

    const response = await service.runAgent('user-123', 'proj-123', {
      prompt: 'Explain failure',
    });

    expect(response).toBeDefined();
    expect(response.answer).toContain('Based on CloudPilot diagnostics');
  });
});
