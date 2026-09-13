import { Test, TestingModule } from '@nestjs/testing';
import { WebhookReceiverService } from './webhook-receiver.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../security/crypto.service';
import { DeploymentService } from '../../deployment/deployment.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('WebhookReceiverService', () => {
  let service: WebhookReceiverService;
  let cryptoService: CryptoService;

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
    },
    environment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    githubWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 'evt-123', ...data })),
      update: jest.fn().mockImplementation(({ data }) => ({ id: 'evt-123', ...data })),
    },
  };

  const mockDeploymentService = {
    deployWithVersion: jest.fn().mockResolvedValue({
      id: 'dep-webhook-1',
      deploymentNumber: 42,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookReceiverService,
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('01234567890123456789012345678901'),
          },
        },
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

    service = module.get<WebhookReceiverService>(WebhookReceiverService);
    cryptoService = module.get<CryptoService>(CryptoService);
    cryptoService.initKey('01234567890123456789012345678901');
  });

  it('should handle ping event gracefully', async () => {
    mockPrisma.githubWebhookEvent.findUnique.mockResolvedValueOnce(null);

    const res = await service.processGitHubWebhook(
      'del-ping-1',
      'ping',
      undefined,
      JSON.stringify({ zen: 'Keep it logically awesome.' }),
      { zen: 'Keep it logically awesome.' },
    );

    expect(res.status).toBe('PROCESSED');
    expect(res.message).toContain('Ping');
  });

  it('should return DUPLICATE for already-received delivery ID (idempotency)', async () => {
    mockPrisma.githubWebhookEvent.findUnique.mockResolvedValueOnce({
      id: 'evt-1',
      deliveryId: 'del-duplicate-1',
      projectId: 'proj-123',
      status: 'PROCESSED',
    });

    const res = await service.processGitHubWebhook(
      'del-duplicate-1',
      'push',
      undefined,
      '{}',
      {},
    );

    expect(res.status).toBe('DUPLICATE');
    expect(res.projectId).toBe('proj-123');
  });

  it('should verify valid HMAC signature and trigger deployment when autoDeployEnabled is true', async () => {
    const webhookSecret = 'my-webhook-secret-123';
    const encryptedSecret = cryptoService.encrypt(webhookSecret);

    mockPrisma.githubWebhookEvent.findUnique.mockResolvedValueOnce(null);
    mockPrisma.project.findFirst.mockResolvedValueOnce({
      id: 'proj-123',
      userId: 'user-123',
      githubRepositoryId: 999888,
      repositoryFullName: 'cloudpilot/test-repo',
      webhookSecret: encryptedSecret,
    });

    mockPrisma.environment.findMany.mockResolvedValueOnce([
      {
        id: 'env-prod',
        name: 'production',
        branchPattern: 'main',
        autoDeployEnabled: true,
      },
    ]);

    const payload = {
      repository: { id: 999888, full_name: 'cloudpilot/test-repo' },
      ref: 'refs/heads/main',
      after: 'abc1234567890',
      head_commit: { message: 'feat: add CI/CD pipeline' },
      sender: { login: 'octocat' },
    };
    const rawPayload = JSON.stringify(payload);
    const signature = `sha256=${crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex')}`;

    const res = await service.processGitHubWebhook(
      'del-push-valid',
      'push',
      signature,
      rawPayload,
      payload,
    );

    expect(res.status).toBe('PROCESSED');
    expect(res.deploymentId).toBe('dep-webhook-1');
    expect(mockDeploymentService.deployWithVersion).toHaveBeenCalledWith(
      'user-123',
      'proj-123',
      expect.objectContaining({
        environmentId: 'env-prod',
        commitSha: 'abc1234567890',
        branch: 'main',
        triggerType: 'WEBHOOK',
      }),
    );
  });

  it('should reject invalid HMAC signature', async () => {
    const webhookSecret = 'my-webhook-secret-123';
    const encryptedSecret = cryptoService.encrypt(webhookSecret);

    mockPrisma.githubWebhookEvent.findUnique.mockResolvedValueOnce(null);
    mockPrisma.project.findFirst.mockResolvedValueOnce({
      id: 'proj-123',
      githubRepositoryId: 999888,
      webhookSecret: encryptedSecret,
    });

    const payload = { repository: { id: 999888 }, ref: 'refs/heads/main' };
    const rawPayload = JSON.stringify(payload);
    const invalidSignature = 'sha256=badsignature00000000000000000000000000000000000000000000000000000';

    await expect(
      service.processGitHubWebhook(
        'del-push-invalid',
        'push',
        invalidSignature,
        rawPayload,
        payload,
      ),
    ).rejects.toThrow('Invalid webhook cryptographic signature');
  });

  it('should record IGNORED when autoDeployEnabled is false on matched environment', async () => {
    mockPrisma.githubWebhookEvent.findUnique.mockResolvedValueOnce(null);
    mockPrisma.project.findFirst.mockResolvedValueOnce({
      id: 'proj-123',
      githubRepositoryId: 999888,
      webhookSecret: null,
    });

    mockPrisma.environment.findMany.mockResolvedValueOnce([
      {
        id: 'env-dev',
        name: 'development',
        branchPattern: 'develop',
        autoDeployEnabled: false,
      },
    ]);

    const payload = {
      repository: { id: 999888 },
      ref: 'refs/heads/develop',
      after: 'def456',
    };

    const res = await service.processGitHubWebhook(
      'del-push-ignored',
      'push',
      undefined,
      JSON.stringify(payload),
      payload,
    );

    expect(res.status).toBe('IGNORED');
    expect(res.reason).toContain('Auto-deploy');
    expect(mockDeploymentService.deployWithVersion).not.toHaveBeenCalled();
  });

  it('should handle concurrent duplicate delivery race condition gracefully when create throws P2002', async () => {
    mockPrisma.githubWebhookEvent.findUnique.mockResolvedValueOnce(null); // Passed initial check

    mockPrisma.project.findFirst.mockResolvedValueOnce({
      id: 'proj-123',
      githubRepositoryId: 111222,
      webhookSecret: null,
    });

    mockPrisma.environment.findMany.mockResolvedValueOnce([
      {
        id: 'env-prod',
        name: 'production',
        branchPattern: 'main',
        autoDeployEnabled: true,
      },
    ]);

    // Simulate concurrent insert winning the race
    const p2002Err: any = new Error('Unique constraint failed on the fields: (`delivery_id`)');
    p2002Err.code = 'P2002';
    mockPrisma.githubWebhookEvent.create.mockRejectedValueOnce(p2002Err);

    const payload = {
      repository: { id: 111222 },
      ref: 'refs/heads/main',
      after: 'commit123',
    };

    const res = await service.processGitHubWebhook(
      'del-concurrent-race',
      'push',
      undefined,
      JSON.stringify(payload),
      payload,
    );

    expect(res.status).toBe('DUPLICATE');
    expect(res.deliveryId).toBe('del-concurrent-race');
  });
});
