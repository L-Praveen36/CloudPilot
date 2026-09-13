import { Test, TestingModule } from '@nestjs/testing';
import { CicdController } from './cicd.controller';
import { CicdService } from './cicd.service';
import { AuthGuard } from '../auth/guards/auth.guard';

describe('CicdController', () => {
  let controller: CicdController;
  let cicdService: Partial<CicdService>;

  const mockUser = { id: 'user-1' };
  const mockReq = { user: mockUser };

  beforeEach(async () => {
    cicdService = {
      getEnvironments: jest.fn().mockResolvedValue([
        { id: 'env-1', name: 'Production', type: 'PRODUCTION' },
      ]),
      getEnvironment: jest.fn().mockResolvedValue({ id: 'env-1', name: 'Production', type: 'PRODUCTION' }),
      createEnvironment: jest.fn().mockResolvedValue({ id: 'env-2', name: 'Staging', type: 'STAGING' }),
      updateEnvironment: jest.fn().mockResolvedValue({ id: 'env-1', autoDeployEnabled: false }),
      deleteEnvironment: jest.fn().mockResolvedValue(undefined),
      getEnvironmentVariables: jest.fn().mockResolvedValue([
        { id: 'v-1', key: 'DATABASE_URL', isSecret: true },
      ]),
      setEnvironmentVariable: jest.fn().mockResolvedValue({ id: 'v-2', key: 'PORT', isSecret: false }),
      deleteEnvironmentVariable: jest.fn().mockResolvedValue(undefined),
      rollbackDeployment: jest.fn().mockResolvedValue({
        message: 'Deployment rollback initiated',
        rolledBackFromId: 'dep-failed',
        rolledBackToId: 'dep-target',
        rollbackDeployment: { id: 'dep-rollback', deploymentNumber: 3 },
      }),
      getCicdSettings: jest.fn().mockResolvedValue({
        webhookUrl: '/webhooks/github',
        webhookSecretConfigured: true,
        defaultBranch: 'main',
      }),
      updateCicdSettings: jest.fn().mockResolvedValue({
        webhookUrl: '/webhooks/github',
        webhookSecretConfigured: true,
        defaultBranch: 'main',
      }),
      getWebhookEvents: jest.fn().mockResolvedValue([
        { id: 'evt-1', deliveryId: 'deliv-1', status: 'PROCESSED' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CicdController],
      providers: [
        {
          provide: CicdService,
          useValue: cicdService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CicdController>(CicdController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return environments', async () => {
    const res = await controller.getEnvironments(mockReq, 'p-1');
    expect(res.environments).toHaveLength(1);
    expect(cicdService.getEnvironments).toHaveBeenCalledWith('user-1', 'p-1');
  });

  it('should create an environment', async () => {
    const res = await controller.createEnvironment(mockReq, 'p-1', {
      name: 'Staging',
      type: 'STAGING' as any,
      branchPattern: 'staging',
      autoDeployEnabled: true,
      autoRollbackEnabled: false,
    });
    expect(res.environment.name).toBe('Staging');
  });

  it('should get variables', async () => {
    const res = await controller.getEnvironmentVariables(mockReq, 'p-1', 'env-1');
    expect(res.variables).toHaveLength(1);
  });

  it('should set variable', async () => {
    const res = await controller.setEnvironmentVariable(mockReq, 'p-1', 'env-1', {
      key: 'PORT',
      value: '3000',
      isSecret: false,
    });
    expect(res.variable.key).toBe('PORT');
  });

  it('should rollback deployment', async () => {
    const res = await controller.rollbackDeployment(mockReq, 'p-1', 'dep-failed', {
      targetDeploymentId: 'dep-target',
    });
    expect(res.rollbackDeployment.id).toBe('dep-rollback');
    expect(cicdService.rollbackDeployment).toHaveBeenCalledWith(
      'user-1',
      'p-1',
      'dep-failed',
      { targetDeploymentId: 'dep-target' },
    );
  });

  it('should get and update cicd settings', async () => {
    const getRes = await controller.getCicdSettings(mockReq, 'p-1');
    expect(getRes.settings.webhookSecretConfigured).toBe(true);

    const updateRes = await controller.updateCicdSettings(mockReq, 'p-1', {
      webhookSecret: 'new-secret',
    });
    expect(updateRes.settings.webhookSecretConfigured).toBe(true);
  });

  it('should get webhook events', async () => {
    const res = await controller.getWebhookEvents(mockReq, 'p-1', '10');
    expect(res.events).toHaveLength(1);
    expect(cicdService.getWebhookEvents).toHaveBeenCalledWith('user-1', 'p-1', 10);
  });
});
