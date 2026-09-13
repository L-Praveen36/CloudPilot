import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { DeploymentPlanService } from './services/deployment-plan.service';
import { DockerExecutionService } from './services/docker-execution.service';
import { PrismaService } from '../prisma/prisma.service';
import { RepositorySourceService } from '../repository-intelligence/services/repository-source.service';
import { RepositoryAnalyzerService } from '../repository-intelligence/services/repository-analyzer.service';
import { ApplicationStructureService } from '../repository-intelligence/services/application-structure.service';
import { DeploymentReadinessService } from '../repository-intelligence/services/deployment-readiness.service';
import { DeploymentPlan, DeploymentReadinessDto } from '@cloudpilot/shared';
import { EnvironmentService } from '../cicd/services/environment.service';
import { RollbackService } from '../cicd/services/rollback.service';

describe('DeploymentService (Phase 4)', () => {
  let service: DeploymentService;
  let prisma: PrismaService;
  let planService: DeploymentPlanService;
  let dockerService: DockerExecutionService;
  let sourceService: RepositorySourceService;
  let environmentService: EnvironmentService;

  const mockUser1Id = 'user-uuid-1';
  const mockUser2Id = 'user-uuid-2';

  const mockProject1 = {
    id: 'proj-1',
    userId: mockUser1Id,
    repositoryFullName: 'cloudpilot/next-app',
    status: 'CONNECTED',
  };

  const mockProject2 = {
    id: 'proj-2',
    userId: mockUser2Id,
    repositoryFullName: 'user2/unowned-app',
    status: 'CONNECTED',
  };

  const mockPlan: DeploymentPlan = {
    strategy: 'NODE_APPLICATION',
    isSupported: true,
    canDeploy: true,
    buildMethod: 'docker build',
    runtimeMethod: 'docker run',
    dockerfileStrategy: 'GENERATED',
    exposedPort: 3000,
    healthCheckStrategy: 'HTTP',
    healthCheckPath: '/',
    requiredEnvVars: [],
    optionalEnvVars: [],
    blockers: [],
    warnings: [],
    summary: 'Ready for deployment',
    createdAt: new Date().toISOString(),
  };

  let mockDeploymentsDb: any[] = [];

  beforeEach(async () => {
    mockDeploymentsDb = [];

    const mockPrisma = {
      project: {
        findFirst: jest.fn(({ where }: any) => {
          if (where.id === 'proj-1' && where.userId === mockUser1Id) return Promise.resolve(mockProject1);
          if (where.id === 'proj-2' && where.userId === mockUser2Id) return Promise.resolve(mockProject2);
          return Promise.resolve(null);
        }),
      },
      deployment: {
        findFirst: jest.fn(({ where }: any) => {
          const found = mockDeploymentsDb.find((d) => {
            if (where.id && d.id !== where.id) return false;
            if (where.projectId && d.projectId !== where.projectId) return false;
            if (where.userId && d.userId !== where.userId) return false;
            if (where.status?.in && !where.status.in.includes(d.status)) return false;
            return true;
          });
          return Promise.resolve(found || null);
        }),
        findMany: jest.fn(({ where }: any) => {
          const matches = mockDeploymentsDb.filter((d) => d.projectId === where.projectId && d.userId === where.userId);
          return Promise.resolve(matches);
        }),
        create: jest.fn(({ data }: any) => {
          const record = {
            id: 'deploy-uuid-' + Date.now(),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockDeploymentsDb.push(record);
          return Promise.resolve(record);
        }),
        update: jest.fn(({ where, data }: any) => {
          const index = mockDeploymentsDb.findIndex((d) => d.id === where.id);
          if (index !== -1) {
            mockDeploymentsDb[index] = {
              ...mockDeploymentsDb[index],
              ...data,
              updatedAt: new Date(),
            };
            return Promise.resolve(mockDeploymentsDb[index]);
          }
          return Promise.resolve(null);
        }),
      },
      environment: {
        findFirst: jest.fn(({ where }: any) => {
          if (where?.id === 'env-dev-1') {
            return Promise.resolve({ id: 'env-dev-1', projectId: 'proj-1', name: 'development' });
          }
          if (where?.id === 'env-prod-1') {
            return Promise.resolve({ id: 'env-prod-1', projectId: 'proj-1', name: 'production' });
          }
          if (where?.id === 'env-other-proj') {
            return Promise.resolve({ id: 'env-other-proj', projectId: 'proj-other', name: 'production' });
          }
          if (where?.projectId === 'proj-1' && where?.name === 'production') {
            return Promise.resolve({ id: 'env-prod-1', projectId: 'proj-1', name: 'production' });
          }
          if (where?.projectId === 'proj-1') {
            return Promise.resolve({ id: 'env-prod-1', projectId: 'proj-1', name: 'production' });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const mockSourceService = {
      withRepositorySource: jest.fn().mockImplementation(async (userId, projectId, callback) => {
        return callback({
          repositoryFullName: 'cloudpilot/next-app',
          branch: 'main',
          workspacePath: '/tmp/cp-src-mock',
          fileCount: 20,
        });
      }),
    };

    const mockAnalyzerService = {
      analyzeWorkspace: jest.fn().mockResolvedValue({
        projectType: 'WEB_APPLICATION',
        primaryLanguage: 'TypeScript',
        framework: 'Next.js',
      }),
    };

    const mockStructureService = {
      detectStructure: jest.fn().mockResolvedValue({
        primaryRole: 'FULLSTACK',
        topLevelPort: { port: 3000, confidence: 'HIGH' },
        applications: [],
        relationships: [],
      }),
    };

    const mockReadinessService = {
      analyzeReadiness: jest.fn().mockReturnValue({
        status: 'READY',
        strategy: 'NODE_APPLICATION',
        score: 100,
        blockers: [],
        warnings: [],
      } as Partial<DeploymentReadinessDto>),
    };

    const mockPlanService = {
      generatePlan: jest.fn().mockReturnValue(mockPlan),
    };

    const mockDockerService = {
      isDockerAvailable: jest.fn().mockResolvedValue(true),
      buildImage: jest.fn().mockResolvedValue({ success: true, durationMs: 2500 }),
      runContainer: jest.fn().mockResolvedValue({ success: true }),
      checkHttpHealth: jest.fn().mockResolvedValue(true),
      findAvailablePort: jest.fn().mockResolvedValue(11050),
      stopAndRemoveContainer: jest.fn().mockResolvedValue(undefined),
      removeImage: jest.fn().mockResolvedValue(undefined),
      getContainerDiagnostics: jest.fn().mockResolvedValue({
        running: false,
        exitCode: 1,
        oomKilled: false,
        logs: 'Error: OPENAI_API_KEY environment variable is missing or empty',
        sanitizedRuntimeError: 'The OPENAI_API_KEY environment variable is missing or empty.',
      }),
      sanitizeLog: jest.fn((s) => s),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RepositorySourceService, useValue: mockSourceService },
        { provide: RepositoryAnalyzerService, useValue: mockAnalyzerService },
        { provide: ApplicationStructureService, useValue: mockStructureService },
        { provide: DeploymentReadinessService, useValue: mockReadinessService },
        { provide: DeploymentPlanService, useValue: mockPlanService },
        { provide: DockerExecutionService, useValue: mockDockerService },
        {
          provide: EnvironmentService,
          useValue: {
            getDecryptedVariablesForExecution: jest.fn().mockResolvedValue({}),
            ensureDefaultEnvironments: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RollbackService,
          useValue: {
            evaluateAutoRollback: jest.fn().mockResolvedValue(false),
            rollbackDeployment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeploymentService>(DeploymentService);
    prisma = module.get<PrismaService>(PrismaService);
    planService = module.get<DeploymentPlanService>(DeploymentPlanService);
    dockerService = module.get<DockerExecutionService>(DockerExecutionService);
    sourceService = module.get<RepositorySourceService>(RepositorySourceService);
    environmentService = module.get<EnvironmentService>(EnvironmentService);
  });

  // -------------------------------------------------------------------------
  // 1. createDeploymentPlan Tests
  // -------------------------------------------------------------------------

  describe('1. createDeploymentPlan', () => {
    it('should generate dry-run deployment plan for project owner', async () => {
      const plan = await service.createDeploymentPlan(mockUser1Id, 'proj-1');

      expect(plan.strategy).toBe('NODE_APPLICATION');
      expect(plan.canDeploy).toBe(true);
      expect(plan.exposedPort).toBe(3000);
      expect(sourceService.withRepositorySource).toHaveBeenCalledWith(mockUser1Id, 'proj-1', expect.any(Function));
    });

    it('should throw 404 when accessing unowned project', async () => {
      await expect(service.createDeploymentPlan(mockUser1Id, 'proj-2')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // 2. deploy Tests
  // -------------------------------------------------------------------------

  describe('2. deploy', () => {
    it('should create initial deployment record and trigger pipeline', async () => {
      const deployment = await service.deploy(mockUser1Id, 'proj-1');

      expect(deployment.projectId).toBe('proj-1');
      expect(deployment.strategy).toBe('NODE_APPLICATION');
      expect(mockDeploymentsDb).toHaveLength(1);
    });

    it('should reject deployment with 409 Conflict if another deployment is in progress', async () => {
      mockDeploymentsDb.push({
        id: 'active-deploy-1',
        projectId: 'proj-1',
        userId: mockUser1Id,
        status: 'BUILDING',
      });

      await expect(service.deploy(mockUser1Id, 'proj-1')).rejects.toThrow(ConflictException);
    });

    it('should reject deployment with 400 BadRequest if plan is not deployable', async () => {
      (planService.generatePlan as jest.Mock).mockReturnValueOnce({
        ...mockPlan,
        canDeploy: false,
        blockers: [{ code: 'MISSING_RUNTIME', message: 'No start command found' }],
      });

      await expect(service.deploy(mockUser1Id, 'proj-1')).rejects.toThrow(BadRequestException);
    });

    it('should deploy with explicit Development environmentId', async () => {
      const deployment = await service.deploy(mockUser1Id, 'proj-1', 'env-dev-1');

      expect(deployment.projectId).toBe('proj-1');
      expect(deployment.environmentId).toBe('env-dev-1');
      expect(environmentService.getDecryptedVariablesForExecution).toHaveBeenCalledWith('env-dev-1');
    });

    it('should deploy with explicit Production environmentId', async () => {
      const deployment = await service.deploy(mockUser1Id, 'proj-1', 'env-prod-1');

      expect(deployment.projectId).toBe('proj-1');
      expect(deployment.environmentId).toBe('env-prod-1');
      expect(environmentService.getDecryptedVariablesForExecution).toHaveBeenCalledWith('env-prod-1');
    });

    it('should reject deployment with 400 BadRequest if environmentId belongs to another project', async () => {
      await expect(service.deploy(mockUser1Id, 'proj-1', 'env-other-proj')).rejects.toThrow(BadRequestException);
    });

    it('should reject deployment with 404 NotFound if environmentId does not exist', async () => {
      await expect(service.deploy(mockUser1Id, 'proj-1', 'env-nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should preserve default production environment when no environmentId is supplied', async () => {
      const deployment = await service.deploy(mockUser1Id, 'proj-1');

      expect(deployment.environmentId).toBe('env-prod-1');
      expect(environmentService.getDecryptedVariablesForExecution).toHaveBeenCalledWith('env-prod-1');
    });
  });

  // -------------------------------------------------------------------------
  // 3. cancelDeployment Tests
  // -------------------------------------------------------------------------

  describe('3. cancelDeployment', () => {
    it('should cancel active deployment and update status', async () => {
      const record = await prisma.deployment.create({
        data: {
          projectId: 'proj-1',
          userId: mockUser1Id,
          status: 'BUILDING',
          strategy: 'NODE_APPLICATION',
        },
      });

      const cancelled = await service.cancelDeployment(mockUser1Id, 'proj-1', record.id);

      expect(cancelled.status).toBe('CANCELLED');
    });

    it('should throw 404 when cancelling nonexistent or unowned deployment', async () => {
      await expect(service.cancelDeployment(mockUser1Id, 'proj-1', 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // 4. getDeployments & getDeploymentLogs Tests
  // -------------------------------------------------------------------------

  describe('4. Queries & Logs', () => {
    it('should list deployments for project owner', async () => {
      await prisma.deployment.create({
        data: {
          projectId: 'proj-1',
          userId: mockUser1Id,
          status: 'RUNNING',
          strategy: 'NODE_APPLICATION',
        },
      });

      const list = await service.getDeployments(mockUser1Id, 'proj-1');
      expect(list).toHaveLength(1);
      expect(list[0].status).toBe('RUNNING');
    });

    it('should retrieve deployment logs', async () => {
      const record = await prisma.deployment.create({
        data: {
          projectId: 'proj-1',
          userId: mockUser1Id,
          status: 'RUNNING',
          strategy: 'NODE_APPLICATION',
          logs: [{ timestamp: new Date().toISOString(), level: 'INFO', message: 'Build complete', stage: 'BUILD' }],
        },
      });

      const logsRes = await service.getDeploymentLogs(mockUser1Id, 'proj-1', record.id);
      expect(logsRes.logs).toHaveLength(1);
      expect(logsRes.logs[0].message).toBe('Build complete');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Phase 7 Deployment Numbering & Concurrency
  // -------------------------------------------------------------------------

  describe('5. Phase 7 Deployment Numbering & Concurrency', () => {
    it('should assign sequential deployment numbers and configuration versions', async () => {
      const dep1 = await service.deployWithVersion(mockUser1Id, 'proj-1', {
        reusePlan: mockPlan,
      });
      expect(dep1.deploymentNumber).toBe(1);
      expect(dep1.configurationVersion).toBe('v1');

      // Update status to RUNNING so next deployment is not blocked by active deployment guard
      const idx = mockDeploymentsDb.findIndex((d) => d.id === dep1.id);
      if (idx !== -1) mockDeploymentsDb[idx].status = 'RUNNING';

      const dep2 = await service.deployWithVersion(mockUser1Id, 'proj-1', {
        reusePlan: mockPlan,
      });
      expect(dep2.deploymentNumber).toBe(2);
      expect(dep2.configurationVersion).toBe('v2');
    });

    it('should retry deploymentNumber allocation on P2002 unique constraint collision', async () => {
      let attempts = 0;
      (prisma.deployment.create as jest.Mock).mockImplementation((args: any) => {
        attempts++;
        if (attempts === 1) {
          const err: any = new Error('Unique constraint failed on the fields: (`deployment_number`)');
          err.code = 'P2002';
          err.meta = { target: ['deployment_number'] };
          return Promise.reject(err);
        }
        const record = {
          id: 'deploy-uuid-retry-' + Date.now(),
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDeploymentsDb.push(record);
        return Promise.resolve(record);
      });

      const dep = await service.deployWithVersion(mockUser1Id, 'proj-1', {
        reusePlan: mockPlan,
      });

      expect(attempts).toBe(2);
      expect(dep).toBeDefined();
    });

    it('should clean up failed Docker image on pipeline failure', async () => {
      jest.spyOn(dockerService, 'buildImage').mockResolvedValueOnce({
        success: false,
        durationMs: 100,
        error: 'Dockerfile syntax error',
      });

      const depRecord = {
        id: 'dep-cleanup-test',
        projectId: 'proj-1',
        userId: mockUser1Id,
        status: 'PENDING',
        deploymentNumber: 1,
      };
      mockDeploymentsDb.push(depRecord);

      await service.executeDeploymentPipeline('dep-cleanup-test', mockUser1Id, 'proj-1', mockPlan);

      expect(dockerService.removeImage).toHaveBeenCalled();
    });

    it('should reject deployment in preflight when required environment variables are missing', async () => {
      const planWithReqs = {
        ...mockPlan,
        requiredEnvVars: ['OPENAI_API_KEY'],
      };

      await expect(
        service.deployWithVersion(mockUser1Id, 'proj-1', {
          reusePlan: planWithReqs,
        }),
      ).rejects.toThrow('Missing required environment variable: OPENAI_API_KEY');
    });

    it('should proceed in preflight when required environment variables are configured', async () => {
      const planWithReqs = {
        ...mockPlan,
        requiredEnvVars: ['OPENAI_API_KEY'],
      };

      jest.spyOn(environmentService, 'getDecryptedVariablesForExecution').mockResolvedValueOnce({
        OPENAI_API_KEY: 'sk-test-key-12345',
      });

      const dep = await service.deployWithVersion(mockUser1Id, 'proj-1', {
        reusePlan: planWithReqs,
      });

      expect(dep).toBeDefined();
      expect(dep.status).toBe('PENDING');
    });

    it('should capture container diagnostics before cleaning up failed container on health check failure', async () => {
      jest.spyOn(dockerService, 'checkHttpHealth').mockResolvedValueOnce(false);

      const depRecord = {
        id: 'dep-diag-test',
        projectId: 'proj-1',
        userId: mockUser1Id,
        status: 'PENDING',
        deploymentNumber: 1,
      };
      mockDeploymentsDb.push(depRecord);

      await service.executeDeploymentPipeline('dep-diag-test', mockUser1Id, 'proj-1', mockPlan);

      expect(dockerService.getContainerDiagnostics).toHaveBeenCalled();
      expect(dockerService.stopAndRemoveContainer).toHaveBeenCalled();
      expect(dockerService.removeImage).toHaveBeenCalled();
    });
  });
});
