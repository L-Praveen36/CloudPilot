import { Test, TestingModule } from '@nestjs/testing';
import { RollbackService } from './rollback.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentService } from '../../deployment/deployment.service';

describe('RollbackService', () => {
  let service: RollbackService;

  const mockPrisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'proj-123', userId: 'user-123' }),
    },
    deployment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const mockDeploymentService = {
    deployWithVersion: jest.fn().mockResolvedValue({
      id: 'dep-rollback-new',
      deploymentNumber: 43,
      isRollback: true,
      commitSha: 'healthy-sha-123',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RollbackService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: DeploymentService,
          useValue: mockDeploymentService,
        },
      ],
    }).compile();

    service = module.get<RollbackService>(RollbackService);
  });

  it('should find previous healthy deployment and trigger rollback creating a new deployment', async () => {
    // Current failed deployment (#42)
    mockPrisma.deployment.findFirst
      .mockResolvedValueOnce({
        id: 'dep-failed-42',
        projectId: 'proj-123',
        environmentId: 'env-prod',
        deploymentNumber: 42,
      }) // 1. current deployment
      .mockResolvedValueOnce(null) // 2. concurrency check (no active deployment)
      .mockResolvedValueOnce({
        id: 'dep-healthy-41',
        projectId: 'proj-123',
        environmentId: 'env-prod',
        deploymentNumber: 41,
        commitSha: 'healthy-sha-123',
        branch: 'main',
        strategy: 'NODE_APPLICATION',
        status: 'RUNNING',
        healthStatus: 'HEALTHY',
        plan: { strategy: 'NODE_APPLICATION', canDeploy: true },
      }); // 3. target healthy deployment

    const res = await service.rollbackDeployment('user-123', 'proj-123', 'dep-failed-42');

    expect(res).toBeDefined();
    expect(res.rolledBackFromId).toBe('dep-failed-42');
    expect(res.rolledBackToId).toBe('dep-healthy-41');
    expect(mockDeploymentService.deployWithVersion).toHaveBeenCalledWith(
      'user-123',
      'proj-123',
      expect.objectContaining({
        environmentId: 'env-prod',
        commitSha: 'healthy-sha-123',
        triggerType: 'ROLLBACK',
        isRollback: true,
      }),
    );
  });

  it('should prevent auto-rollback loops if failed deployment was already a rollback', async () => {
    mockPrisma.deployment.findUnique.mockResolvedValueOnce({
      id: 'dep-rollback-failed',
      projectId: 'proj-123',
      environmentId: 'env-prod',
      environment: { autoRollbackEnabled: true },
      isRollback: true, // ALREADY A ROLLBACK
      triggerType: 'ROLLBACK',
    });

    const triggered = await service.evaluateAutoRollback('dep-rollback-failed');
    expect(triggered).toBe(false);
  });

  it('should prevent auto-rollback when maxRollbackAttempts is reached', async () => {
    mockPrisma.deployment.findUnique.mockResolvedValueOnce({
      id: 'dep-failed-1',
      projectId: 'proj-123',
      environmentId: 'env-prod',
      environment: { autoRollbackEnabled: true, maxRollbackAttempts: 1, name: 'production' },
      isRollback: false,
      triggerType: 'MANUAL',
    });
    // 1 recent rollback in the last hour already exists
    mockPrisma.deployment.count.mockResolvedValueOnce(1);

    const triggered = await service.evaluateAutoRollback('dep-failed-1');
    expect(triggered).toBe(false);
  });

  it('should reject rollback on unowned project with NotFoundException', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.rollbackDeployment('user-unauthorized', 'proj-123', 'dep-failed-42'),
    ).rejects.toThrow();
  });
});
