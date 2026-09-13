import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiRepoUnderstandingService } from './services/ai-repo-understanding.service';
import { AiDeploymentGeneratorService } from './services/ai-deployment-generator.service';
import { AiFailureDiagnosisService } from './services/ai-failure-diagnosis.service';
import { AiRepairSuggestionService } from './services/ai-repair-suggestion.service';
import { AiAgentService } from './services/ai-agent.service';
import { ObservabilityService } from '../observability/observability.service';
import { NotFoundException } from '@nestjs/common';

describe('AiService', () => {
  let service: AiService;

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
    },
    deployment: {
      findFirst: jest.fn(),
    },
    repositoryAnalysis: {
      findUnique: jest.fn(),
    },
  };

  const mockRepoUnderstandingService = {
    generateUnderstanding: jest.fn().mockResolvedValue({ summary: 'Understood' }),
  };

  const mockDeploymentGeneratorService = {
    generateProposal: jest.fn().mockResolvedValue({ strategy: 'NODE_NEXTJS' }),
  };

  const mockFailureDiagnosisService = {
    diagnoseBuildFailure: jest.fn().mockResolvedValue({ problem: 'Build failed' }),
    diagnoseIncident: jest.fn().mockResolvedValue({ problem: 'Incident occurred' }),
  };

  const mockRepairSuggestionService = {
    generateSuggestions: jest.fn().mockResolvedValue([{ title: 'Fix Env' }]),
    getSuggestions: jest.fn().mockResolvedValue([]),
    approveSuggestion: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
    rejectSuggestion: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
  };

  const mockAgentService = {
    runAgent: jest.fn().mockResolvedValue({ answer: 'Here is the answer' }),
  };

  const mockObservabilityService = {
    getDeploymentTelemetry: jest.fn().mockResolvedValue({ healthStatus: 'HEALTHY' }),
    getDeploymentEvents: jest.fn().mockResolvedValue({ events: [] }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiRepoUnderstandingService, useValue: mockRepoUnderstandingService },
        { provide: AiDeploymentGeneratorService, useValue: mockDeploymentGeneratorService },
        { provide: AiFailureDiagnosisService, useValue: mockFailureDiagnosisService },
        { provide: AiRepairSuggestionService, useValue: mockRepairSuggestionService },
        { provide: AiAgentService, useValue: mockAgentService },
        { provide: ObservabilityService, useValue: mockObservabilityService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should throw NotFoundException if project not owned by user', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getRepositoryUnderstanding('wrong-user', 'proj-123'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should delegate repository understanding when authorized', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce({
      id: 'proj-123',
      userId: 'user-123',
      repositoryName: 'my-repo',
    });
    mockPrisma.repositoryAnalysis.findUnique.mockResolvedValueOnce({
      id: 'ana-1',
      projectId: 'proj-123',
      projectType: 'WEB_APPLICATION',
      primaryLanguage: 'TypeScript',
      framework: 'Next.js',
      packageManager: 'npm',
      isMonorepo: false,
      hasDockerfile: false,
      hasDockerCompose: false,
      hasEnvExample: false,
      detectedFiles: [],
      structure: null,
      readiness: null,
      analysisVersion: '2.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getRepositoryUnderstanding('user-123', 'proj-123');
    expect(result).toBeDefined();
    expect(mockRepoUnderstandingService.generateUnderstanding).toHaveBeenCalled();
  });
});
