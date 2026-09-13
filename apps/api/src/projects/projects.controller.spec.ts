import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AuthGuard, SESSION_COOKIE_NAME } from '../auth/guards/auth.guard';
import { AuthService } from '../auth/auth.service';
import { UserDto, ProjectDto } from '@cloudpilot/shared';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let service: ProjectsService;
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

  const mockProject: ProjectDto = {
    id: 'proj-uuid-1',
    userId: 'user-auth-uuid-1',
    githubRepositoryId: 123456,
    repositoryOwner: 'cloudpilot',
    repositoryName: 'cloudpilot-core',
    repositoryFullName: 'cloudpilot/cloudpilot-core',
    defaultBranch: 'main',
    private: true,
    cloneUrl: 'https://github.com/cloudpilot/cloudpilot-core.git',
    htmlUrl: 'https://github.com/cloudpilot/cloudpilot-core',
    status: 'CONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const mockProjectsService = {
      createProject: jest.fn().mockResolvedValue(mockProject),
      listProjects: jest.fn().mockResolvedValue([mockProject]),
      getProject: jest.fn().mockResolvedValue(mockProject),
      deleteProject: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Project disconnected successfully' }),
    };

    const mockAuthService = {
      validateSession: jest.fn((token) => {
        if (token === 'valid_session') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: AuthService, useValue: mockAuthService },
        AuthGuard,
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    service = module.get<ProjectsService>(ProjectsService);
    authGuard = module.get<AuthGuard>(AuthGuard);
  });

  describe('AuthGuard on ProjectsController', () => {
    it('should throw UnauthorizedException on unauthenticated request to /projects', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {}, headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow access when valid session cookie is provided', async () => {
      const req: any = {
        cookies: { [SESSION_COOKIE_NAME]: 'valid_session' },
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as unknown as ExecutionContext;

      const canActivate = await authGuard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user).toEqual(mockUser);
    });
  });

  describe('Controller Handlers Execution', () => {
    it('should call createProject with current user ID and DTO', async () => {
      const dto = {
        githubRepositoryId: 123456,
        repositoryOwner: 'cloudpilot',
        repositoryName: 'cloudpilot-core',
      };

      const result = await controller.createProject(mockUser, dto);

      expect(service.createProject).toHaveBeenCalledWith('user-auth-uuid-1', dto);
      expect(result.project.id).toBe('proj-uuid-1');
      expect(result.project.status).toBe('CONNECTED');
    });

    it('should call listProjects with current user ID', async () => {
      const result = await controller.listProjects(mockUser);

      expect(service.listProjects).toHaveBeenCalledWith('user-auth-uuid-1');
      expect(result.projects).toHaveLength(1);
    });

    it('should call getProject with current user ID and project ID param', async () => {
      const result = await controller.getProject(mockUser, { id: 'proj-uuid-1' });

      expect(service.getProject).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.project.id).toBe('proj-uuid-1');
    });

    it('should call deleteProject with current user ID and project ID param', async () => {
      const result = await controller.deleteProject(mockUser, { id: 'proj-uuid-1' });

      expect(service.deleteProject).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.success).toBe(true);
    });
  });
});
