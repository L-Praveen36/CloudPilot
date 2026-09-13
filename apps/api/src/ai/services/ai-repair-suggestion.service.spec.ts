import { Test, TestingModule } from '@nestjs/testing';
import { AiRepairSuggestionService } from './ai-repair-suggestion.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible.provider';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { ConfigService } from '@nestjs/config';

describe('AiRepairSuggestionService', () => {
  let service: AiRepairSuggestionService;

  const mockPrisma = {
    aiRepairSuggestion: {
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'sug-123',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRepairSuggestionService,
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

    service = module.get<AiRepairSuggestionService>(AiRepairSuggestionService);
  });

  it('should generate structured repair suggestion requiring human approval', async () => {
    const suggestions = await service.generateSuggestions(
      'proj-123',
      {
        id: 'dep-123',
        projectId: 'proj-123',
        userId: 'user-123',
        status: 'FAILED',
        strategy: 'NODE_APPLICATION',
        imageTag: null,
        containerName: null,
        exposedPort: null,
        hostPort: null,
        url: null,
        healthStatus: 'UNHEALTHY',
        startedAt: null,
        completedAt: null,
        buildDurationMs: null,
        runtimeDurationMs: null,
        buildSummary: null,
        runtimeSummary: null,
        errorMessage: 'Missing DB connection',
        plan: null,
        logs: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        category: 'INCIDENT',
        problem: 'Database connection failed',
        likelyCause: 'DATABASE_URL missing',
        affectedComponent: 'Server DB Pool',
        evidence: [],
        recommendation: 'Configure DATABASE_URL environment variable',
        confidence: 'HIGH',
        confidenceRationale: 'Direct match with runtime error',
        diagnosedAt: new Date().toISOString(),
        modelIdentifier: 'cloudpilot-mock-v1',
      },
    );

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].requiresHumanApproval).toBe(true);
    expect(suggestions[0].status).toBe('PROPOSED');
  });

  it('should handle human approval transition to APPROVED', async () => {
    mockPrisma.aiRepairSuggestion.findFirst.mockResolvedValueOnce({
      id: 'sug-123',
      projectId: 'proj-123',
      status: 'PROPOSED',
      title: 'Fix',
      problem: 'Problem',
      proposedChange: {},
      reasoning: 'Reason',
      risk: 'LOW',
      requiresHumanApproval: true,
      evidence: [],
      confidence: 'HIGH',
      validationRequirements: [],
      modelIdentifier: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.aiRepairSuggestion.update.mockResolvedValueOnce({
      id: 'sug-123',
      projectId: 'proj-123',
      status: 'APPROVED',
      title: 'Fix',
      problem: 'Problem',
      proposedChange: {},
      reasoning: 'Reason',
      risk: 'LOW',
      requiresHumanApproval: true,
      evidence: [],
      confidence: 'HIGH',
      validationRequirements: [],
      modelIdentifier: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const approved = await service.approveSuggestion('proj-123', 'sug-123');
    expect(approved.status).toBe('APPROVED');
  });
});
