import { Test, TestingModule } from '@nestjs/testing';
import { AiFailureDiagnosisService } from './ai-failure-diagnosis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible.provider';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { ConfigService } from '@nestjs/config';

describe('AiFailureDiagnosisService', () => {
  let service: AiFailureDiagnosisService;

  const mockPrisma = {
    aiDiagnosis: {
      create: jest.fn().mockResolvedValue({ id: 'diag-123' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiFailureDiagnosisService,
        AiContextSanitizerService,
        AiProviderFactory,
        MockAiProvider,
        OpenAiCompatibleProvider,
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

    service = module.get<AiFailureDiagnosisService>(AiFailureDiagnosisService);
  });

  it('should diagnose build failures and distinguish FACT from INFERENCE', async () => {
    const diagnosis = await service.diagnoseBuildFailure(
      'proj-123',
      {
        id: 'dep-123',
        projectId: 'proj-123',
        userId: 'user-123',
        status: 'FAILED',
        strategy: 'NODE_APPLICATION',
        imageTag: 'cloudpilot-app:latest',
        containerName: 'cp-app-123',
        exposedPort: 3000,
        hostPort: null,
        url: null,
        healthStatus: 'UNHEALTHY',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        buildDurationMs: 1500,
        runtimeDurationMs: null,
        buildSummary: null,
        runtimeSummary: null,
        errorMessage: 'Docker build exited with code 1',
        plan: null,
        logs: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message: 'Error: Cannot find module @cloudpilot/shared',
          stage: 'BUILD',
        },
      ],
    );

    expect(diagnosis).toBeDefined();
    expect(diagnosis.category).toBe('BUILD');
    expect(diagnosis.confidence).toBe('HIGH');
    expect(diagnosis.evidence.some((e) => e.type === 'FACT')).toBe(true);
    expect(mockPrisma.aiDiagnosis.create).toHaveBeenCalled();
  });
});
