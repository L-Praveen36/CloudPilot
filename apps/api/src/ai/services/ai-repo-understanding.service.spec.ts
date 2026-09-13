import { Test, TestingModule } from '@nestjs/testing';
import { AiRepoUnderstandingService } from './ai-repo-understanding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible.provider';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { ConfigService } from '@nestjs/config';

describe('AiRepoUnderstandingService', () => {
  let service: AiRepoUnderstandingService;

  const mockPrisma = {
    aiAnalysis: {
      create: jest.fn().mockResolvedValue({ id: 'test-ai-id' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRepoUnderstandingService,
        AiContextSanitizerService,
        AiProviderFactory,
        MockAiProvider,
        OpenAiCompatibleProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock'),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AiRepoUnderstandingService>(AiRepoUnderstandingService);
  });

  it('should generate structured repository understanding', async () => {
    const result = await service.generateUnderstanding(
      'proj-123',
      {
        id: 'analysis-123',
        projectId: 'proj-123',
        projectType: 'WEB_APPLICATION',
        primaryLanguage: 'TypeScript',
        framework: 'Next.js',
        packageManager: 'pnpm',
        isMonorepo: false,
        hasDockerfile: false,
        hasDockerCompose: false,
        hasEnvExample: true,
        detectedFiles: ['package.json', 'next.config.js'],
        structure: null,
        readiness: null,
        analysisVersion: '2.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      null,
      null,
      'my-nextjs-app',
    );

    expect(result).toBeDefined();
    expect(result.technology.primaryLanguage).toBe('TypeScript');
    expect(result.technology.framework).toBe('Next.js');
    expect(result.confidence).toBe('HIGH');
    expect(result.evidenceSummary.length).toBeGreaterThan(0);
    expect(mockPrisma.aiAnalysis.create).toHaveBeenCalled();
  });
});
