import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthService } from '../auth/auth.service';
import { UserDto, DeploymentDto, DeploymentPlan } from '@cloudpilot/shared';

describe('DeploymentController (Phase 4)', () => {
  let controller: DeploymentController;
  let service: DeploymentService;
  let authGuard: AuthGuard;

  const mockUser: UserDto = {
    id: 'user-auth-uuid-1',
    githubId: '987654',
    username: 'cloudpilot_user',
    email: 'user@cloudpilot.io',
    name: 'CloudPilot User',
    avatarUrl: 'https://avatar.com/user',
    createdAt: new Date(),
    updatedAt: new Date(),
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
    summary: 'Plan generated',
    createdAt: new Date().toISOString(),
  };

  const mockDeployment: DeploymentDto = {
    id: 'deploy-1',
    projectId: 'proj-1',
    userId: mockUser.id,
    status: 'RUNNING',
    strategy: 'NODE_APPLICATION',
    imageTag: 'cloudpilot-proj-1-deploy-1:latest',
    exposedPort: 3000,
    hostPort: 11050,
    url: 'http://localhost:11050',
    healthStatus: 'HEALTHY',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    buildDurationMs: 3000,
    runtimeDurationMs: 4500,
    buildSummary: 'Built successfully',
    runtimeSummary: 'Running on port 11050',
    errorMessage: null,
    plan: mockPlan,
    logs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const mockDeploymentService = {
      createDeploymentPlan: jest.fn().mockResolvedValue(mockPlan),
      deploy: jest.fn().mockResolvedValue(mockDeployment),
      cancelDeployment: jest.fn().mockResolvedValue({ ...mockDeployment, status: 'CANCELLED' }),
      getDeployments: jest.fn().mockResolvedValue([mockDeployment]),
      getDeployment: jest.fn().mockResolvedValue(mockDeployment),
      getDeploymentLogs: jest.fn().mockResolvedValue({ deploymentId: 'deploy-1', status: 'RUNNING', logs: [] }),
    };

    const mockAuthService = {
      validateSession: jest.fn((token) => {
        if (token === 'valid_session') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentController],
      providers: [
        { provide: DeploymentService, useValue: mockDeploymentService },
        { provide: AuthService, useValue: mockAuthService },
        AuthGuard,
      ],
    }).compile();

    controller = module.get<DeploymentController>(DeploymentController);
    service = module.get<DeploymentService>(DeploymentService);
    authGuard = module.get<AuthGuard>(AuthGuard);
  });

  describe('AuthGuard on DeploymentController', () => {
    it('should throw UnauthorizedException on unauthenticated request', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {}, headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Endpoints', () => {
    it('POST /projects/:id/deployment-plan should return generated plan', async () => {
      const result = await controller.getDeploymentPlan(mockUser, { id: 'proj-1' });

      expect(service.createDeploymentPlan).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-1');
      expect(result.plan.strategy).toBe('NODE_APPLICATION');
    });

    it('POST /projects/:id/deploy should trigger deployment without environmentId and return DTO', async () => {
      const result = await controller.deployProject(mockUser, { id: 'proj-1' });

      expect(service.deploy).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-1', undefined);
      expect(result.deployment.status).toBe('RUNNING');
    });

    it('POST /projects/:id/deploy should trigger deployment with explicit environmentId', async () => {
      const result = await controller.deployProject(mockUser, { id: 'proj-1' }, { environmentId: 'env-dev-1' });

      expect(service.deploy).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-1', 'env-dev-1');
      expect(result.deployment.status).toBe('RUNNING');
    });

    it('POST /projects/:id/deployments/:deploymentId/cancel should cancel deployment', async () => {
      const result = await controller.cancelDeployment(mockUser, 'proj-1', 'deploy-1');

      expect(service.cancelDeployment).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-1', 'deploy-1');
      expect(result.deployment.status).toBe('CANCELLED');
    });

    it('GET /projects/:id/deployments should list deployments', async () => {
      const result = await controller.listDeployments(mockUser, { id: 'proj-1' });

      expect(service.getDeployments).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-1');
      expect(result.deployments).toHaveLength(1);
    });

    it('GET /projects/:id/deployments/:deploymentId should return deployment detail', async () => {
      const result = await controller.getDeployment(mockUser, 'proj-1', 'deploy-1');

      expect(service.getDeployment).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-1', 'deploy-1');
      expect(result.deployment.id).toBe('deploy-1');
    });

    it('GET /projects/:id/deployments/:deploymentId/logs should return logs', async () => {
      const result = await controller.getDeploymentLogs(mockUser, 'proj-1', 'deploy-1');

      expect(service.getDeploymentLogs).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-1', 'deploy-1');
      expect(result.deploymentId).toBe('deploy-1');
    });
  });
});
