import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubRepositoryService } from '../github/github-repository.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;
  let githubRepoService: GitHubRepositoryService;

  const mockUser1Id = 'user-uuid-1';
  const mockUser2Id = 'user-uuid-2';

  const mockGithubRepo = {
    id: 123456,
    name: 'cloudpilot-core',
    fullName: 'cloudpilot/cloudpilot-core',
    description: 'CloudPilot core orchestration',
    htmlUrl: 'https://github.com/cloudpilot/cloudpilot-core',
    cloneUrl: 'https://github.com/cloudpilot/cloudpilot-core.git',
    sshUrl: 'git@github.com:cloudpilot/cloudpilot-core.git',
    defaultBranch: 'main',
    private: true,
    fork: false,
    language: 'TypeScript',
    stars: 50,
    forks: 10,
    openIssues: 3,
    updatedAt: '2026-08-28T00:00:00Z',
    pushedAt: '2026-08-28T00:00:00Z',
    owner: {
      login: 'cloudpilot',
      avatarUrl: 'https://avatars.github.com/u/123456',
    },
  };

  let mockProjectsDb: any[] = [];

  beforeEach(async () => {
    mockProjectsDb = [
      {
        id: 'proj-1',
        userId: mockUser1Id,
        githubRepositoryId: 1001,
        repositoryOwner: 'cloudpilot',
        repositoryName: 'existing-repo',
        repositoryFullName: 'cloudpilot/existing-repo',
        defaultBranch: 'main',
        private: false,
        cloneUrl: 'https://github.com/cloudpilot/existing-repo.git',
        htmlUrl: 'https://github.com/cloudpilot/existing-repo',
        status: 'CONNECTED',
        createdAt: new Date('2026-08-28T00:00:00Z'),
        updatedAt: new Date('2026-08-28T00:00:00Z'),
      },
      {
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
        createdAt: new Date('2026-08-28T00:00:00Z'),
        updatedAt: new Date('2026-08-28T00:00:00Z'),
      },
    ];

    const mockPrisma = {
      project: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.userId_githubRepositoryId) {
            const found = mockProjectsDb.find(
              (p) =>
                p.userId === where.userId_githubRepositoryId.userId &&
                p.githubRepositoryId === where.userId_githubRepositoryId.githubRepositoryId,
            );
            return Promise.resolve(found || null);
          }
          return Promise.resolve(mockProjectsDb.find((p) => p.id === where.id) || null);
        }),
        findFirst: jest.fn(({ where }: any) => {
          const found = mockProjectsDb.find(
            (p) => p.id === where.id && (where.userId ? p.userId === where.userId : true),
          );
          return Promise.resolve(found || null);
        }),
        findMany: jest.fn(({ where }: any) => {
          return Promise.resolve(mockProjectsDb.filter((p) => p.userId === where.userId));
        }),
        create: jest.fn(({ data }: any) => {
          const newProject = {
            id: 'new-proj-' + Date.now(),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockProjectsDb.push(newProject);
          return Promise.resolve(newProject);
        }),
        delete: jest.fn(({ where }: any) => {
          const index = mockProjectsDb.findIndex((p) => p.id === where.id);
          if (index !== -1) {
            const deleted = mockProjectsDb.splice(index, 1)[0];
            return Promise.resolve(deleted);
          }
          return Promise.resolve(null);
        }),
      },
    };

    const mockGitHubService = {
      getRepository: jest.fn((userId, owner, repo) => {
        if (owner === 'cloudpilot' && repo === 'cloudpilot-core') {
          return Promise.resolve({ repository: mockGithubRepo });
        }
        if (owner === 'nonexistent') {
          return Promise.reject(new NotFoundException('GitHub repository not found'));
        }
        if (owner === 'unauthorized') {
          return Promise.reject(new UnauthorizedException('GitHub token expired'));
        }
        return Promise.resolve({
          repository: {
            ...mockGithubRepo,
            id: 999999,
            name: repo,
            fullName: `${owner}/${repo}`,
          },
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GitHubRepositoryService, useValue: mockGitHubService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);
    githubRepoService = module.get<GitHubRepositoryService>(GitHubRepositoryService);
  });

  describe('1-5. Project Creation & Verification', () => {
    it('1. should create a project for authenticated user after server-side GitHub verification', async () => {
      const result = await service.createProject(mockUser1Id, {
        githubRepositoryId: 123456,
        repositoryOwner: 'cloudpilot',
        repositoryName: 'cloudpilot-core',
      });

      expect(githubRepoService.getRepository).toHaveBeenCalledWith(
        mockUser1Id,
        'cloudpilot',
        'cloudpilot-core',
      );
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(mockUser1Id);
      expect(result.githubRepositoryId).toBe(123456);
      expect(result.repositoryFullName).toBe('cloudpilot/cloudpilot-core');
      expect(result.status).toBe('CONNECTED');

      // Verify no sensitive tokens are attached
      expect((result as any).accessToken).toBeUndefined();
      expect((result as any).clientSecret).toBeUndefined();
    });

    it('2. should reject duplicate repository connection for the same user with 409 Conflict', async () => {
      // Mock returning existing repo id 1001
      jest.spyOn(githubRepoService, 'getRepository').mockResolvedValueOnce({
        repository: {
          ...mockGithubRepo,
          id: 1001,
          name: 'existing-repo',
          fullName: 'cloudpilot/existing-repo',
        },
      });

      await expect(
        service.createProject(mockUser1Id, {
          githubRepositoryId: 1001,
          repositoryOwner: 'cloudpilot',
          repositoryName: 'existing-repo',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should reject if the provided githubRepositoryId does not match the verified GitHub repository', async () => {
      await expect(
        service.createProject(mockUser1Id, {
          githubRepositoryId: 999999, // Mismatch with actual id 123456
          repositoryOwner: 'cloudpilot',
          repositoryName: 'cloudpilot-core',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. should reject if GitHub repository is not found (404)', async () => {
      await expect(
        service.createProject(mockUser1Id, {
          githubRepositoryId: 123,
          repositoryOwner: 'nonexistent',
          repositoryName: 'missing-repo',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('5. should handle GitHub unauthorized error (401)', async () => {
      await expect(
        service.createProject(mockUser1Id, {
          githubRepositoryId: 123,
          repositoryOwner: 'unauthorized',
          repositoryName: 'repo',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('6-8. Project Listing & Detail Access Control', () => {
    it('6. should list only the authenticated user projects', async () => {
      const list = await service.listProjects(mockUser1Id);

      expect(list.length).toBeGreaterThanOrEqual(1);
      for (const p of list) {
        expect(p.userId).toBe(mockUser1Id);
      }
      expect(list.find((p) => p.userId === mockUser2Id)).toBeUndefined();
    });

    it('7. should retrieve user own project', async () => {
      const project = await service.getProject(mockUser1Id, 'proj-1');

      expect(project.id).toBe('proj-1');
      expect(project.userId).toBe(mockUser1Id);
      expect(project.repositoryFullName).toBe('cloudpilot/existing-repo');
    });

    it('8. should return 404 when user attempts to retrieve another user project', async () => {
      await expect(service.getProject(mockUser1Id, 'proj-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('9-12. Project Deletion / Disconnection', () => {
    it('9. should delete own project successfully', async () => {
      const result = await service.deleteProject(mockUser1Id, 'proj-1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('disconnected');
    });

    it('10. should return 404 when user attempts to delete another user project', async () => {
      await expect(service.deleteProject(mockUser1Id, 'proj-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('11. should return 404 when deleting a non-existent project', async () => {
      await expect(
        service.deleteProject(mockUser1Id, 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('13-18. Security & Data Sanitization', () => {
    it('15. should ensure Project records and DTOs never contain OAuth tokens or secrets', async () => {
      const project = await service.getProject(mockUser1Id, 'proj-1');

      expect((project as any).accessToken).toBeUndefined();
      expect((project as any).clientSecret).toBeUndefined();
      expect((project as any).password).toBeUndefined();
      expect((project as any).encryptionKey).toBeUndefined();
    });
  });
});
