import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GitHubRepositoryController } from './github-repository.controller';
import { GitHubRepositoryService } from './github-repository.service';
import { AuthGuard, SESSION_COOKIE_NAME } from '../auth/guards/auth.guard';
import { AuthService } from '../auth/auth.service';
import { UserDto, GitHubRepositoryDto } from '@cloudpilot/shared';

describe('GitHubRepositoryController', () => {
  let controller: GitHubRepositoryController;
  let service: GitHubRepositoryService;
  let authGuard: AuthGuard;

  const mockUser: UserDto = {
    id: 'user-auth-123',
    githubId: '987654',
    username: 'cloudpilot_user',
    email: 'user@cloudpilot.io',
    name: 'CloudPilot User',
    avatarUrl: 'https://avatar.com/user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo: GitHubRepositoryDto = {
    id: 111,
    name: 'test-repo',
    fullName: 'cloudpilot/test-repo',
    description: 'Test repository',
    htmlUrl: 'https://github.com/cloudpilot/test-repo',
    cloneUrl: 'https://github.com/cloudpilot/test-repo.git',
    sshUrl: 'git@github.com:cloudpilot/test-repo.git',
    defaultBranch: 'main',
    private: false,
    fork: false,
    language: 'TypeScript',
    stars: 10,
    forks: 1,
    openIssues: 0,
    updatedAt: '2026-08-27T00:00:00Z',
    pushedAt: '2026-08-27T00:00:00Z',
    owner: {
      login: 'cloudpilot',
      avatarUrl: 'https://avatar.com/org',
    },
  };

  beforeEach(async () => {
    const mockRepoService = {
      listRepositories: jest.fn().mockResolvedValue({
        repositories: [mockRepo],
        pagination: { page: 1, perPage: 30, hasNextPage: false, hasPreviousPage: false },
      }),
      getRepository: jest.fn().mockResolvedValue({
        repository: mockRepo,
      }),
      listBranches: jest.fn().mockResolvedValue({
        branches: [{ name: 'main', sha: '123', protected: true }],
        pagination: { page: 1, perPage: 30, hasNextPage: false, hasPreviousPage: false },
      }),
    };

    const mockAuthService = {
      validateSession: jest.fn((token) => {
        if (token === 'valid_session') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GitHubRepositoryController],
      providers: [
        { provide: GitHubRepositoryService, useValue: mockRepoService },
        { provide: AuthService, useValue: mockAuthService },
        AuthGuard,
      ],
    }).compile();

    controller = module.get<GitHubRepositoryController>(GitHubRepositoryController);
    service = module.get<GitHubRepositoryService>(GitHubRepositoryService);
    authGuard = module.get<AuthGuard>(AuthGuard);
  });

  describe('AuthGuard on GitHubRepositoryController', () => {
    it('should throw UnauthorizedException on unauthenticated request to /github/repositories', async () => {
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

  describe('Controller Handler Execution', () => {
    it('should call listRepositories with current user ID and query parameters', async () => {
      const result = await controller.listRepositories(mockUser, { page: 1, perPage: 30 });

      expect(service.listRepositories).toHaveBeenCalledWith('user-auth-123', {
        page: 1,
        perPage: 30,
      });
      expect(result.repositories).toHaveLength(1);
      expect(result.repositories[0].name).toBe('test-repo');
    });

    it('should call getRepository with current user ID, owner, and repo params', async () => {
      const result = await controller.getRepository(mockUser, {
        owner: 'cloudpilot',
        repo: 'test-repo',
      });

      expect(service.getRepository).toHaveBeenCalledWith(
        'user-auth-123',
        'cloudpilot',
        'test-repo',
      );
      expect(result.repository.id).toBe(111);
    });

    it('should call listBranches with current user ID, owner, repo, and query params', async () => {
      const result = await controller.listBranches(
        mockUser,
        { owner: 'cloudpilot', repo: 'test-repo' },
        { page: 1, perPage: 10 },
      );

      expect(service.listBranches).toHaveBeenCalledWith(
        'user-auth-123',
        'cloudpilot',
        'test-repo',
        { page: 1, perPage: 10 },
      );
      expect(result.branches).toHaveLength(1);
    });
  });
});
