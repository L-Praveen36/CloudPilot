import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadGatewayException } from '@nestjs/common';
import { RepositoryIntelligenceService } from './repository-intelligence.service';
import { RepositoryAnalyzerService } from './services/repository-analyzer.service';
import { RepositorySourceService, SourceAcquisitionMetadata } from './services/repository-source.service';
import { ApplicationStructureService } from './services/application-structure.service';
import { DeploymentReadinessService } from './services/deployment-readiness.service';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubRepositoryService } from '../github/github-repository.service';
import { ApplicationStructureDto, DeploymentReadinessDto } from '@cloudpilot/shared';

describe('RepositoryIntelligenceService', () => {
  let service: RepositoryIntelligenceService;
  let prisma: PrismaService;
  let githubRepoService: GitHubRepositoryService;
  let analyzerService: RepositoryAnalyzerService;
  let structureService: ApplicationStructureService;
  let readinessService: DeploymentReadinessService;
  let mockSourceService: jest.Mocked<Partial<RepositorySourceService>>;

  const mockUser1Id = 'user-uuid-1';
  const mockUser2Id = 'user-uuid-2';

  const mockProject1 = {
    id: 'proj-1',
    userId: mockUser1Id,
    githubRepositoryId: 1001,
    repositoryOwner: 'cloudpilot',
    repositoryName: 'cloudpilot-core',
    repositoryFullName: 'cloudpilot/cloudpilot-core',
    defaultBranch: 'main',
    private: false,
    cloneUrl: 'https://github.com/cloudpilot/cloudpilot-core.git',
    htmlUrl: 'https://github.com/cloudpilot/cloudpilot-core',
    status: 'CONNECTED',
  };

  const mockProject2 = {
    id: 'proj-2',
    userId: mockUser2Id,
    githubRepositoryId: 2002,
    repositoryOwner: 'user2',
    repositoryName: 'user2-repo',
    repositoryFullName: 'user2/user2-repo',
    defaultBranch: 'main',
    private: true,
    cloneUrl: 'https://github.com/user2/user2-repo.git',
    htmlUrl: 'https://github.com/user2/user2-repo',
    status: 'CONNECTED',
  };

  const mockStructureResult: ApplicationStructureDto = {
    primaryRole: 'FULLSTACK',
    confidence: 'HIGH',
    applications: [
      {
        name: 'web',
        path: 'apps/web',
        role: 'FRONTEND',
        framework: 'Next.js',
        language: 'TypeScript',
        packageManager: 'pnpm',
        entryPoint: { path: 'apps/web/app/page.tsx', isDefault: true, evidence: 'Next.js page' },
        buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
        startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
        port: { port: 3000, source: '.env.example', confidence: 'HIGH' },
        outputDirectory: { path: '.next', isConfigured: false, source: 'Next.js' },
        confidence: 'HIGH',
        evidence: ['Next.js framework'],
      },
    ],
    relationships: [],
    topLevelEntryPoint: { path: 'apps/web/app/page.tsx', isDefault: true, evidence: 'Next.js page' },
    topLevelBuildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
    topLevelStartCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
    topLevelPort: { port: 3000, source: '.env.example', confidence: 'HIGH' },
    topLevelOutputDirectory: { path: '.next', isConfigured: false, source: 'Next.js' },
    evidence: ['Next.js framework'],
  };

  const mockReadinessResult: DeploymentReadinessDto = {
    status: 'READY',
    score: 100,
    strategy: 'NODE_APPLICATION',
    summary: 'Repository is fully ready for deployment.',
    blockers: [],
    warnings: [],
    requirements: [],
    recommendations: [],
    scoreBreakdown: {
      applicationIdentity: 15,
      buildReadiness: 20,
      runtimeReadiness: 20,
      portReadiness: 15,
      outputArtifactReadiness: 10,
      environmentConfiguration: 10,
      deploymentStrategy: 10,
    },
  };

  let mockAnalysesDb: any[] = [];

  beforeEach(async () => {
    mockAnalysesDb = [];

    const mockPrisma = {
      project: {
        findFirst: jest.fn(({ where }: any) => {
          if (where.id === 'proj-1' && where.userId === mockUser1Id) {
            return Promise.resolve(mockProject1);
          }
          if (where.id === 'proj-2' && where.userId === mockUser2Id) {
            return Promise.resolve(mockProject2);
          }
          return Promise.resolve(null);
        }),
      },
      repositoryAnalysis: {
        findUnique: jest.fn(({ where }: any) => {
          const found = mockAnalysesDb.find((a) => a.projectId === where.projectId);
          return Promise.resolve(found || null);
        }),
        upsert: jest.fn(({ where, create, update }: any) => {
          const index = mockAnalysesDb.findIndex((a) => a.projectId === where.projectId);
          if (index !== -1) {
            const updated = {
              ...mockAnalysesDb[index],
              ...update,
              updatedAt: new Date(),
            };
            mockAnalysesDb[index] = updated;
            return Promise.resolve(updated);
          }
          const created = {
            id: 'analysis-uuid-' + Date.now(),
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAnalysesDb.push(created);
          return Promise.resolve(created);
        }),
      },
    };

    const mockGitHubRepoService = {
      getRepositoryTree: jest.fn(),
      getRepositoryFileContent: jest.fn(),
    };

    const mockAnalyzerService = {
      analyzeWorkspace: jest.fn().mockResolvedValue({
        projectType: 'WEB_APPLICATION',
        primaryLanguage: 'TypeScript',
        framework: 'Next.js',
        packageManager: 'npm',
        isMonorepo: false,
        hasDockerfile: false,
        hasDockerCompose: false,
        hasEnvExample: true,
        detectedFiles: ['next.config.ts', 'package.json', 'tsconfig.json'],
      }),
      analyze: jest.fn(),
    };

    const mockStructureService = {
      detectStructure: jest.fn().mockResolvedValue(mockStructureResult),
    };

    const mockReadinessService = {
      analyzeReadiness: jest.fn().mockReturnValue(mockReadinessResult),
    };

    mockSourceService = {
      withRepositorySource: jest.fn().mockImplementation(
        async <T>(userId: string, projectId: string, consumer: (ctx: any) => Promise<T>): Promise<T> => {
          return consumer({
            repositoryFullName: 'cloudpilot/cloudpilot-core',
            branch: 'main',
            commitSha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
            fileCount: 42,
            workspacePath: '/tmp/cp-src-mock-workspace',
          });
        },
      ) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoryIntelligenceService,
        { provide: RepositoryAnalyzerService, useValue: mockAnalyzerService },
        { provide: ApplicationStructureService, useValue: mockStructureService },
        { provide: DeploymentReadinessService, useValue: mockReadinessService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GitHubRepositoryService, useValue: mockGitHubRepoService },
        { provide: RepositorySourceService, useValue: mockSourceService },
      ],
    }).compile();

    service = module.get<RepositoryIntelligenceService>(RepositoryIntelligenceService);
    prisma = module.get<PrismaService>(PrismaService);
    githubRepoService = module.get<GitHubRepositoryService>(GitHubRepositoryService);
    analyzerService = module.get<RepositoryAnalyzerService>(RepositoryAnalyzerService);
    structureService = module.get<ApplicationStructureService>(ApplicationStructureService);
    readinessService = module.get<DeploymentReadinessService>(DeploymentReadinessService);
  });

  // -------------------------------------------------------------------------
  // Integrated analyzeProject Tests
  // -------------------------------------------------------------------------

  describe('analyzeProject', () => {
    it('1. should acquire source and execute stack, structure, and readiness analysis (version 2.0.0)', async () => {
      const result = await service.analyzeProject(mockUser1Id, 'proj-1');

      expect(mockSourceService.withRepositorySource).toHaveBeenCalledWith(
        mockUser1Id,
        'proj-1',
        expect.any(Function),
      );
      expect(analyzerService.analyzeWorkspace).toHaveBeenCalledWith('/tmp/cp-src-mock-workspace');
      expect(structureService.detectStructure).toHaveBeenCalledWith('/tmp/cp-src-mock-workspace');
      expect(readinessService.analyzeReadiness).toHaveBeenCalled();
      expect(result.projectId).toBe('proj-1');
      expect(result.projectType).toBe('WEB_APPLICATION');
      expect(result.structure).toBeDefined();
      expect(result.readiness).toBeDefined();
      expect(result.readiness?.status).toBe('READY');
      expect(mockAnalysesDb).toHaveLength(1);
    });

    it('2. should re-analyze project and update existing record without duplicating rows', async () => {
      await service.analyzeProject(mockUser1Id, 'proj-1');
      expect(mockAnalysesDb).toHaveLength(1);

      const reanalyzed = await service.analyzeProject(mockUser1Id, 'proj-1');
      expect(mockAnalysesDb).toHaveLength(1);
      expect(reanalyzed.projectId).toBe('proj-1');
      expect(reanalyzed.analysisVersion).toBe('2.0.0');
    });

    it('3. should throw 404 when project does not exist or belongs to another user', async () => {
      await expect(service.analyzeProject(mockUser1Id, 'proj-2')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.analyzeProject(mockUser1Id, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Phase 3.4 — analyzeProjectReadiness & getProjectReadiness Tests
  // -------------------------------------------------------------------------

  describe('analyzeProjectReadiness & getProjectReadiness', () => {
    it('4. should acquire source, evaluate readiness, and persist to PostgreSQL', async () => {
      const result = await service.analyzeProjectReadiness(mockUser1Id, 'proj-1');

      expect(mockSourceService.withRepositorySource).toHaveBeenCalledWith(
        mockUser1Id,
        'proj-1',
        expect.any(Function),
      );
      expect(readinessService.analyzeReadiness).toHaveBeenCalled();
      expect(result.status).toBe('READY');
      expect(result.strategy).toBe('NODE_APPLICATION');
      expect(mockAnalysesDb).toHaveLength(1);
      expect(mockAnalysesDb[0].readiness).toBeDefined();
    });

    it('5. should retrieve stored readiness via getProjectReadiness', async () => {
      await service.analyzeProjectReadiness(mockUser1Id, 'proj-1');

      const retrieved = await service.getProjectReadiness(mockUser1Id, 'proj-1');
      expect(retrieved.status).toBe('READY');
      expect(retrieved.score).toBe(100);
    });

    it('6. should throw 404 when accessing another user project readiness', async () => {
      await expect(service.getProjectReadiness(mockUser1Id, 'proj-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('7. should throw 404 when readiness has not been analyzed yet', async () => {
      await expect(service.getProjectReadiness(mockUser1Id, 'proj-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Phase 3.3 — detectApplicationStructure Tests
  // -------------------------------------------------------------------------

  describe('detectApplicationStructure & getProjectStructure', () => {
    it('8. should acquire source and execute structure detection, persisting to DB', async () => {
      const result = await service.detectApplicationStructure(mockUser1Id, 'proj-1');

      expect(mockSourceService.withRepositorySource).toHaveBeenCalledWith(
        mockUser1Id,
        'proj-1',
        expect.any(Function),
      );
      expect(structureService.detectStructure).toHaveBeenCalledWith('/tmp/cp-src-mock-workspace');
      expect(result.primaryRole).toBe('FULLSTACK');
      expect(result.applications[0].name).toBe('web');
      expect(mockAnalysesDb).toHaveLength(1);
      expect(mockAnalysesDb[0].structure).toBeDefined();
    });

    it('9. should retrieve stored structure via getProjectStructure', async () => {
      await service.detectApplicationStructure(mockUser1Id, 'proj-1');

      const retrieved = await service.getProjectStructure(mockUser1Id, 'proj-1');
      expect(retrieved.primaryRole).toBe('FULLSTACK');
      expect(retrieved.applications[0].name).toBe('web');
    });

    it('10. should throw 404 when accessing another user project structure', async () => {
      await expect(service.getProjectStructure(mockUser1Id, 'proj-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // getProjectAnalysis Tests
  // -------------------------------------------------------------------------

  describe('getProjectAnalysis', () => {
    it('11. should retrieve stored analysis for project owner', async () => {
      await service.analyzeProject(mockUser1Id, 'proj-1');

      const analysis = await service.getProjectAnalysis(mockUser1Id, 'proj-1');
      expect(analysis.projectId).toBe('proj-1');
      expect(analysis.framework).toBe('Next.js');
    });

    it('12. should return 404 when accessing another user project analysis', async () => {
      await expect(service.getProjectAnalysis(mockUser1Id, 'proj-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Phase 3.1 — acquireProjectSource tests
  // -------------------------------------------------------------------------

  describe('acquireProjectSource', () => {
    it('13. should delegate to RepositorySourceService.withRepositorySource and return sanitized metadata', async () => {
      const expectedMetadata: SourceAcquisitionMetadata = {
        repositoryFullName: 'cloudpilot/cloudpilot-core',
        branch: 'main',
        commitSha: 'abc123def456',
        fileCount: 142,
      };

      mockSourceService.withRepositorySource!.mockImplementation(
        async (userId, projectId, consumer) => {
          return consumer({
            repositoryFullName: 'cloudpilot/cloudpilot-core',
            branch: 'main',
            commitSha: 'abc123def456',
            fileCount: 142,
            workspacePath: '/tmp/cp-src-internal-never-exposed',
          });
        },
      );

      const result = await service.acquireProjectSource(mockUser1Id, 'proj-1');

      expect(result).toEqual(expectedMetadata);
    });

    it('14. acquireProjectSource result must never contain workspacePath', async () => {
      mockSourceService.withRepositorySource!.mockImplementation(
        async (userId, projectId, consumer) => {
          return consumer({
            repositoryFullName: 'cloudpilot/cloudpilot-core',
            branch: 'main',
            commitSha: null,
            fileCount: 50,
            workspacePath: '/tmp/cp-src-secret-internal-path',
          });
        },
      );

      const result = await service.acquireProjectSource(mockUser1Id, 'proj-1');

      expect(JSON.stringify(result)).not.toContain('workspacePath');
      expect(JSON.stringify(result)).not.toContain('secret-internal-path');
    });
  });
});
