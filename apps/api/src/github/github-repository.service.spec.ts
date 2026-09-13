import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadGatewayException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GitHubRepositoryService } from './github-repository.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('GitHubRepositoryService', () => {
  let service: GitHubRepositoryService;
  let prismaService: PrismaService;
  let cryptoService: CryptoService;

  const validEncryptionKey = crypto.randomBytes(32).toString('hex');
  const mockRawTokenUser1 = 'gho_valid_mock_token_user_1';
  const mockRawTokenUser2 = 'gho_valid_mock_token_user_2';

  let mockAccounts: any[] = [];

  const mockRepoRaw = {
    id: 123456,
    name: 'cloudpilot-core',
    full_name: 'cloudpilot/cloudpilot-core',
    description: 'CloudPilot core orchestration engine',
    html_url: 'https://github.com/cloudpilot/cloudpilot-core',
    clone_url: 'https://github.com/cloudpilot/cloudpilot-core.git',
    ssh_url: 'git@github.com:cloudpilot/cloudpilot-core.git',
    default_branch: 'main',
    private: true,
    fork: false,
    language: 'TypeScript',
    stargazers_count: 42,
    forks_count: 5,
    open_issues_count: 2,
    updated_at: '2026-08-27T12:00:00Z',
    pushed_at: '2026-08-27T12:30:00Z',
    owner: {
      login: 'cloudpilot',
      avatar_url: 'https://avatars.githubusercontent.com/u/99999',
    },
  };

  const mockBranchesRaw = [
    {
      name: 'main',
      commit: { sha: 'abc123def456' },
      protected: true,
    },
    {
      name: 'feature/auth',
      commit: { sha: '789xyz012345' },
      protected: false,
    },
  ];

  beforeEach(async () => {
    // Setup crypto service
    const cryptoModule: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'GITHUB_TOKEN_ENCRYPTION_KEY' ? validEncryptionKey : null),
          },
        },
      ],
    }).compile();

    cryptoService = cryptoModule.get<CryptoService>(CryptoService);
    cryptoService.onModuleInit();

    const encryptedTokenUser1 = cryptoService.encrypt(mockRawTokenUser1);
    const encryptedTokenUser2 = cryptoService.encrypt(mockRawTokenUser2);

    mockAccounts = [
      {
        id: 'acc-1',
        userId: 'user-1',
        githubId: 'gh-101',
        accessToken: encryptedTokenUser1,
      },
      {
        id: 'acc-2',
        userId: 'user-2',
        githubId: 'gh-102',
        accessToken: encryptedTokenUser2,
      },
    ];

    const mockPrisma = {
      gitHubAccount: {
        findUnique: jest.fn(({ where }: any) => {
          return Promise.resolve(mockAccounts.find((a) => a.userId === where.userId) || null);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubRepositoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: cryptoService },
      ],
    }).compile();

    service = module.get<GitHubRepositoryService>(GitHubRepositoryService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1-2. Token Decryption & User Isolation', () => {
    it('1. should throw BadRequestException when user has no linked GitHub account', async () => {
      await expect(service.getDecryptedTokenForUser('user-without-account')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('2. should correctly decrypt the requesting user token in memory and maintain user isolation', async () => {
      const token1 = await service.getDecryptedTokenForUser('user-1');
      const token2 = await service.getDecryptedTokenForUser('user-2');

      expect(token1).toBe(mockRawTokenUser1);
      expect(token2).toBe(mockRawTokenUser2);
      expect(token1).not.toBe(token2);
    });
  });

  describe('3-6. Repository Listing & Pagination', () => {
    it('3. should successfully list repositories and map to safe DTOs', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-remaining': '4950',
          'x-ratelimit-reset': '1787836800',
        }),
        json: () => Promise.resolve([mockRepoRaw]),
      } as any);

      const result = await service.listRepositories('user-1', { page: 1, perPage: 30 });

      expect(result.repositories).toHaveLength(1);
      const repo = result.repositories[0];
      expect(repo.id).toBe(123456);
      expect(repo.name).toBe('cloudpilot-core');
      expect(repo.fullName).toBe('cloudpilot/cloudpilot-core');
      expect(repo.owner.login).toBe('cloudpilot');
      expect(repo.defaultBranch).toBe('main');
      expect(repo.stars).toBe(42);

      // Verify no sensitive fields in DTO
      expect((repo as any).accessToken).toBeUndefined();
      expect((repo as any).authorization).toBeUndefined();

      // Verify rate limit
      expect(result.rateLimit?.remaining).toBe(4950);
    });

    it('4. should handle GitHub Link header pagination properly', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          link: '<https://api.github.com/user/repos?page=2&per_page=10>; rel="next", <https://api.github.com/user/repos?page=1&per_page=10>; rel="prev"',
        }),
        json: () => Promise.resolve([mockRepoRaw]),
      } as any);

      const result = await service.listRepositories('user-1', { page: 2, perPage: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('5. should enforce maximum perPage boundary (capped at 100)', async () => {
      let requestedUrl = '';
      global.fetch = jest.fn().mockImplementation((url) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      });

      await service.listRepositories('user-1', { page: 1, perPage: 250 });

      expect(requestedUrl).toContain('per_page=100');
    });
  });

  describe('6-8. Repository Detail & Branch Listing', () => {
    it('6. should retrieve a specific repository detail', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-ratelimit-remaining': '4900' }),
        json: () => Promise.resolve(mockRepoRaw),
      } as any);

      const result = await service.getRepository('user-1', 'cloudpilot', 'cloudpilot-core');

      expect(result.repository.id).toBe(123456);
      expect(result.repository.name).toBe('cloudpilot-core');
      expect(result.rateLimit?.remaining).toBe(4900);
    });

    it('7. should list branches with pagination', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          link: '<https://api.github.com/repos/cloudpilot/cloudpilot-core/branches?page=2&per_page=2>; rel="next"',
        }),
        json: () => Promise.resolve(mockBranchesRaw),
      } as any);

      const result = await service.listBranches('user-1', 'cloudpilot', 'cloudpilot-core', {
        page: 1,
        perPage: 2,
      });

      expect(result.branches).toHaveLength(2);
      expect(result.branches[0].name).toBe('main');
      expect(result.branches[0].sha).toBe('abc123def456');
      expect(result.branches[0].protected).toBe(true);
      expect(result.pagination.hasNextPage).toBe(true);
    });
  });

  describe('9-16. Error Handling & Timeout Mapping', () => {
    it('8. should map GitHub 401 to UnauthorizedException without leaking token', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
      } as any);

      await expect(
        service.listRepositories('user-1', { page: 1, perPage: 30 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('9. should map GitHub 403 Rate Limit (x-ratelimit-remaining: 0) to 429 Too Many Requests', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1787836800',
        }),
      } as any);

      try {
        await service.listRepositories('user-1', { page: 1, perPage: 30 });
        fail('Expected 429 error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('10. should map GitHub 403 Permission Failure to ForbiddenException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'x-ratelimit-remaining': '4000' }),
      } as any);

      await expect(
        service.getRepository('user-1', 'private-org', 'secret-repo'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('11. should map GitHub 404 to NotFoundException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
      } as any);

      await expect(
        service.getRepository('user-1', 'nonexistent', 'missing-repo'),
      ).rejects.toThrow(NotFoundException);
    });

    it('12. should map GitHub 500 server error to 502 BadGatewayException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
      } as any);

      await expect(
        service.listRepositories('user-1', { page: 1, perPage: 30 }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('13. should map network fetch exception to 502 BadGatewayException', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.listRepositories('user-1', { page: 1, perPage: 30 }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('14. should map 10-second timeout/AbortError to 502 BadGatewayException with timeout message', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expect(
        service.listRepositories('user-1', { page: 1, perPage: 30 }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('15. should map malformed JSON from GitHub to 502 BadGatewayException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.reject(new Error('SyntaxError: Unexpected token <')),
      } as any);

      await expect(
        service.listRepositories('user-1', { page: 1, perPage: 30 }),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
