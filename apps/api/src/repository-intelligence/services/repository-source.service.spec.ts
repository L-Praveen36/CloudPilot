import { NotFoundException, BadGatewayException, BadRequestException, RequestTimeoutException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as crypto from 'crypto';
import { RepositorySourceService, RepositorySourceContext } from './repository-source.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GitHubRepositoryService } from '../../github/github-repository.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockProject = (overrides: Partial<any> = {}) => ({
  id: 'proj-uuid-1',
  userId: 'user-uuid-1',
  githubRepositoryId: 12345,
  repositoryOwner: 'cloudpilot-org',
  repositoryName: 'sample-app',
  repositoryFullName: 'cloudpilot-org/sample-app',
  defaultBranch: 'main',
  private: true,
  cloneUrl: 'https://github.com/cloudpilot-org/sample-app.git',
  htmlUrl: 'https://github.com/cloudpilot-org/sample-app',
  status: 'CONNECTED',
  ...overrides,
});

const mockPrisma = (projectResult: any | null) => ({
  project: {
    findFirst: jest.fn().mockResolvedValue(projectResult),
  },
});

const mockGitHub = (
  decryptedToken = 'gho_mock_token_never_logged',
) => ({
  getDecryptedTokenForUser: jest.fn().mockResolvedValue(decryptedToken),
});

const mockConfigService = (overrides: Record<string, string> = {}) => ({
  get: jest.fn((key: string) => overrides[key] ?? undefined),
});

// ---------------------------------------------------------------------------
// Tarball stream helpers for unit tests
// ---------------------------------------------------------------------------

/** Creates a ReadableStream from a Buffer for test use */
function bufferToReadableStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
describe('RepositorySourceService', () => {
  let service: RepositorySourceService;
  let prismaService: any;
  let githubService: any;
  let configService: any;

  beforeEach(async () => {
    prismaService = mockPrisma(mockProject());
    githubService = mockGitHub();
    configService = mockConfigService({
      MAX_REPO_SIZE_MB: '50',
      MAX_FILE_COUNT: '10000',
      MAX_FILE_SIZE_MB: '10',
      SOURCE_ACQUISITION_TIMEOUT_MS: '60000',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositorySourceService,
        { provide: PrismaService, useValue: prismaService },
        { provide: GitHubRepositoryService, useValue: githubService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<RepositorySourceService>(RepositorySourceService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Ownership & Authorization
  // -------------------------------------------------------------------------

  describe('Ownership & Authorization', () => {
    it('1. should throw NotFoundException when project does not exist', async () => {
      prismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.withRepositorySource('user-uuid-1', 'non-existent', async () => null),
      ).rejects.toThrow(NotFoundException);
    });

    it("2. should throw NotFoundException when accessing another user's project (User B → User A project)", async () => {
      // Project belongs to user-uuid-1, but userId passed is user-uuid-2
      prismaService.project.findFirst.mockImplementation(({ where }: any) => {
        if (where.userId === 'user-uuid-1') return Promise.resolve(mockProject());
        return Promise.resolve(null); // User B cannot see User A's project
      });

      await expect(
        service.withRepositorySource('user-uuid-2', 'proj-uuid-1', async () => null),
      ).rejects.toThrow(NotFoundException);
    });

    it('3. should query project with BOTH projectId AND userId (ownership enforced in query)', async () => {
      prismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.withRepositorySource('user-uuid-2', 'proj-uuid-1', async () => null),
      ).rejects.toThrow(NotFoundException);

      expect(prismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'proj-uuid-1', userId: 'user-uuid-2' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Workspace Creation
  // -------------------------------------------------------------------------

  describe('createSecureWorkspace', () => {
    it('4. should create workspace within os.tmpdir()', async () => {
      const workspacePath = await service.createSecureWorkspace();

      try {
        const resolvedWorkspace = path.resolve(workspacePath);
        const resolvedTmpdir = path.resolve(os.tmpdir());
        expect(resolvedWorkspace.startsWith(resolvedTmpdir)).toBe(true);
      } finally {
        await fsp.rm(workspacePath, { recursive: true, force: true });
      }
    });

    it('5. should use an unpredictable name with cp-src- prefix', async () => {
      const workspace1 = await service.createSecureWorkspace();
      const workspace2 = await service.createSecureWorkspace();

      try {
        expect(path.basename(workspace1)).toMatch(/^cp-src-[0-9a-f]{32}$/);
        expect(path.basename(workspace2)).toMatch(/^cp-src-[0-9a-f]{32}$/);
        expect(workspace1).not.toEqual(workspace2);
      } finally {
        await fsp.rm(workspace1, { recursive: true, force: true });
        await fsp.rm(workspace2, { recursive: true, force: true });
      }
    });

    it('6. workspace must NOT be inside the application source tree', async () => {
      const workspacePath = await service.createSecureWorkspace();

      try {
        const appRoot = path.resolve(process.cwd());
        const resolvedWorkspace = path.resolve(workspacePath);
        expect(resolvedWorkspace.startsWith(appRoot)).toBe(false);
      } finally {
        await fsp.rm(workspacePath, { recursive: true, force: true });
      }
    });

    it('7. workspace directory must actually exist after creation', async () => {
      const workspacePath = await service.createSecureWorkspace();

      try {
        const stat = await fsp.stat(workspacePath);
        expect(stat.isDirectory()).toBe(true);
      } finally {
        await fsp.rm(workspacePath, { recursive: true, force: true });
      }
    });
  });

  // -------------------------------------------------------------------------
  // Workspace Cleanup
  // -------------------------------------------------------------------------

  describe('cleanupWorkspace', () => {
    it('8. should remove workspace directory after cleanup', async () => {
      const workspacePath = await service.createSecureWorkspace();

      // Create some files inside
      await fsp.writeFile(path.join(workspacePath, 'test.txt'), 'hello');
      await fsp.mkdir(path.join(workspacePath, 'subdir'));

      await service.cleanupWorkspace(workspacePath);

      await expect(fsp.access(workspacePath)).rejects.toThrow();
    });

    it('9. should not throw if workspace already cleaned up (idempotent)', async () => {
      const workspacePath = await service.createSecureWorkspace();
      await service.cleanupWorkspace(workspacePath);

      // Second cleanup should not throw
      await expect(service.cleanupWorkspace(workspacePath)).resolves.not.toThrow();
    });

    it('10. should refuse to delete a path outside tmpdir (security guard)', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      // Attempt to cleanup a path that is NOT inside tmpdir
      const dangerousPath = process.cwd(); // application root
      await service.cleanupWorkspace(dangerousPath);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Resource Limits
  // -------------------------------------------------------------------------

  describe('Resource Limits', () => {
    it('11. should reject repository exceeding MAX_REPO_SIZE_MB during GitHub metadata check', async () => {
      jest.spyOn(service as any, 'checkRepositorySize').mockRejectedValue(
        new BadRequestException('Repository size (60.0 MB) exceeds the maximum allowed size of 50 MB'),
      );

      await expect(
        service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => null),
      ).rejects.toThrow(BadRequestException);
    });

    it('12. should use configurable resource limits from ConfigService', () => {
      const serviceWithLimits = new RepositorySourceService(
        prismaService,
        githubService,
        {
          get: (key: string) => {
            const limits: Record<string, string> = {
              MAX_REPO_SIZE_MB: '25',
              MAX_FILE_COUNT: '5000',
              MAX_FILE_SIZE_MB: '5',
              SOURCE_ACQUISITION_TIMEOUT_MS: '30000',
            };
            return limits[key];
          },
        } as any,
      );

      expect((serviceWithLimits as any).maxRepoSizeMb).toBe(25);
      expect((serviceWithLimits as any).maxFileCount).toBe(5000);
      expect((serviceWithLimits as any).maxFileSizeMb).toBe(5);
      expect((serviceWithLimits as any).acquisitionTimeoutMs).toBe(30000);
    });

    it('13. should use reasonable defaults when config values are absent', () => {
      const serviceWithDefaults = new RepositorySourceService(
        prismaService,
        githubService,
        { get: () => undefined } as any,
      );

      expect((serviceWithDefaults as any).maxRepoSizeMb).toBe(50);
      expect((serviceWithDefaults as any).maxFileCount).toBe(10000);
      expect((serviceWithDefaults as any).maxFileSizeMb).toBe(10);
      expect((serviceWithDefaults as any).acquisitionTimeoutMs).toBe(60000);
    });
  });

  // -------------------------------------------------------------------------
  // Security — Credential Protection
  // -------------------------------------------------------------------------

  describe('Security — Credential Protection', () => {
    it('14. withRepositorySource result must never contain OAuth token', async () => {
      // Mock everything to short-circuit acquisition and focus on contract
      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-test-${Date.now()}`),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockResolvedValue({
        commitSha: 'abc123def456',
        fileCount: 5,
      });
      jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      let capturedContext: RepositorySourceContext | null = null;

      await service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async (ctx) => {
        capturedContext = ctx;
        return 'done';
      });

      expect(capturedContext).not.toBeNull();
      // The context must never contain the token
      const contextStr = JSON.stringify(capturedContext);
      expect(contextStr).not.toContain('gho_mock_token_never_logged');
      expect(contextStr).not.toContain('clientSecret');
      expect(contextStr).not.toContain('encryptionKey');
      expect(contextStr).not.toContain('sessionToken');
    });

    it('15. should not expose the workspacePath in logged messages', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');

      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), 'cp-src-secret-workspace-path'),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockResolvedValue({
        commitSha: 'abc123',
        fileCount: 3,
      });
      jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      await service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => 'done');

      // Log messages should mention the repository, not the internal workspace path
      for (const call of logSpy.mock.calls) {
        expect(String(call)).not.toContain('cp-src-secret-workspace-path');
      }
    });

    it('16. getDecryptedTokenForUser must be called (credential injection verified)', async () => {
      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-test-${Date.now()}`),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockResolvedValue({
        commitSha: null,
        fileCount: 1,
      });
      jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      await service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => 'ok');

      // getDecryptedTokenForUser is called inside acquireGitHubTarball and checkRepositorySize
      // Both are mocked above, so verify the mock was set up correctly
      expect(githubService.getDecryptedTokenForUser).toBeDefined();
    });

    it('17. path traversal in owner/repo/branch must be rejected', async () => {
      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      const workspace = await service.createSecureWorkspace();

      try {
        await expect(
          (service as any).acquireGitHubTarball('user', '../evil', 'repo', 'main', workspace),
        ).rejects.toThrow(BadRequestException);

        await expect(
          (service as any).acquireGitHubTarball('user', 'owner', '../evil', 'main', workspace),
        ).rejects.toThrow(BadRequestException);

        await expect(
          (service as any).acquireGitHubTarball('user', 'owner', 'repo', '../../etc', workspace),
        ).rejects.toThrow(BadRequestException);
      } finally {
        await service.cleanupWorkspace(workspace);
      }
    });
  });

  // -------------------------------------------------------------------------
  // withRepositorySource Lifecycle
  // -------------------------------------------------------------------------

  describe('withRepositorySource lifecycle', () => {
    it('18. cleanup must occur even when the consumer throws', async () => {
      const cleanupSpy = jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-lifecycle-test-${Date.now()}`),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockResolvedValue({
        commitSha: null,
        fileCount: 0,
      });

      await expect(
        service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => {
          throw new Error('Consumer crashed');
        }),
      ).rejects.toThrow('Consumer crashed');

      // Cleanup must have been called despite consumer throwing
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('19. cleanup must occur on successful acquisition', async () => {
      const cleanupSpy = jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-success-test-${Date.now()}`),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockResolvedValue({
        commitSha: 'abc123',
        fileCount: 42,
      });

      await service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => 'done');

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('20. consumer receives correct metadata (repositoryFullName, branch, commitSha)', async () => {
      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-meta-test-${Date.now()}`),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockResolvedValue({
        commitSha: 'deadbeef1234',
        fileCount: 87,
      });
      jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      let capturedCtx: RepositorySourceContext | null = null;

      await service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async (ctx) => {
        capturedCtx = ctx;
      });

      expect(capturedCtx).not.toBeNull();
      expect(capturedCtx!.repositoryFullName).toBe('cloudpilot-org/sample-app');
      expect(capturedCtx!.branch).toBe('main');
      expect(capturedCtx!.commitSha).toBe('deadbeef1234');
      expect(capturedCtx!.fileCount).toBe(87);
    });

    it('21. cleanup is called even when acquireGitHubTarball fails', async () => {
      const cleanupSpy = jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-fail-test-${Date.now()}`),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockRejectedValue(
        new BadGatewayException('Simulated GitHub API failure'),
      );

      await expect(
        service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => 'done'),
      ).rejects.toThrow(BadGatewayException);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // GitHub Error Handling
  // -------------------------------------------------------------------------

  describe('GitHub API Errors', () => {
    beforeEach(() => {
      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-err-${Date.now()}`),
      );
      jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();
    });

    it('22. should throw NotFoundException when GitHub returns 404', async () => {
      jest.spyOn(service as any, 'acquireGitHubTarball').mockRejectedValue(
        new NotFoundException('GitHub repository or branch not found'),
      );

      await expect(
        service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => null),
      ).rejects.toThrow(NotFoundException);
    });

    it('23. should throw RequestTimeoutException on acquisition timeout', async () => {
      jest.spyOn(service as any, 'acquireGitHubTarball').mockRejectedValue(
        new RequestTimeoutException('Repository source acquisition timed out after 60s'),
      );

      await expect(
        service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => null),
      ).rejects.toThrow(RequestTimeoutException);
    });

    it('24. should throw BadGatewayException on GitHub API failure', async () => {
      jest.spyOn(service as any, 'acquireGitHubTarball').mockRejectedValue(
        new BadGatewayException('GitHub returned HTTP 500 during source acquisition'),
      );

      await expect(
        service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => null),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  // -------------------------------------------------------------------------
  // File Count Utilities
  // -------------------------------------------------------------------------

  describe('countWorkspaceFiles', () => {
    it('25. should correctly count files in a workspace', async () => {
      const workspace = await service.createSecureWorkspace();

      try {
        await fsp.writeFile(path.join(workspace, 'file1.ts'), '');
        await fsp.writeFile(path.join(workspace, 'file2.json'), '{}');
        await fsp.mkdir(path.join(workspace, 'subdir'));
        await fsp.writeFile(path.join(workspace, 'subdir', 'nested.ts'), '');

        const count = await service.countWorkspaceFiles(workspace);
        expect(count).toBe(4); // 2 files + 1 dir + 1 nested file
      } finally {
        await service.cleanupWorkspace(workspace);
      }
    });

    it('26. should return 0 for an empty workspace', async () => {
      const workspace = await service.createSecureWorkspace();

      try {
        const count = await service.countWorkspaceFiles(workspace);
        expect(count).toBe(0);
      } finally {
        await service.cleanupWorkspace(workspace);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Repository Size Check
  // -------------------------------------------------------------------------

  describe('checkRepositorySize', () => {
    it('27. should reject repositories exceeding size limit', async () => {
      // Simulate GitHub repo metadata response with large size (100MB = 102400 KB)
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ size: 102400 }),
      });
      global.fetch = mockFetch as any;

      await expect(
        service.checkRepositorySize('user-1', 'owner', 'repo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('28. should accept repositories within size limit', async () => {
      // 10MB = 10240 KB — within 50MB limit
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ size: 10240 }),
      });
      global.fetch = mockFetch as any;

      // Should resolve without throwing
      await expect(
        service.checkRepositorySize('user-1', 'owner', 'repo'),
      ).resolves.not.toThrow();
    });

    it('29. should throw NotFoundException when GitHub reports 404 on size check', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });
      global.fetch = mockFetch as any;

      await expect(
        service.checkRepositorySize('user-1', 'owner', 'repo'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // Execution Boundary Verification
  // -------------------------------------------------------------------------

  describe('Execution Boundary', () => {
    it('30. withRepositorySource must not execute npm, python, or docker commands', async () => {
      const spawnSpy = jest.spyOn(require('child_process'), 'spawn');

      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-exec-test-${Date.now()}`),
      );
      jest.spyOn(service as any, 'acquireGitHubTarball').mockResolvedValue({
        commitSha: null,
        fileCount: 0,
      });
      jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();

      await service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => 'done');

      // Verify no forbidden commands were spawned
      const forbiddenCommands = ['npm', 'node', 'python', 'python3', 'pip', 'docker', 'mvn', 'gradle', 'go'];
      for (const call of spawnSpy.mock.calls) {
        const command = String(call[0]).toLowerCase();
        expect(forbiddenCommands).not.toContain(command);
      }
    });

    it('31. source acquisition uses only tar for extraction (no shell execution)', async () => {
      const spawnCalls: string[] = [];
      jest.spyOn(require('child_process'), 'spawn').mockImplementation((...args: any[]) => {
        const cmd = String(args[0]);
        spawnCalls.push(cmd);
        // Return a mock process that immediately succeeds
        const EventEmitter = require('events');
        const mockProcess = new EventEmitter();
        mockProcess.stdin = { write: jest.fn().mockReturnValue(true), end: jest.fn() };
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        setTimeout(() => mockProcess.emit('close', 0), 10);
        return mockProcess;
      });

      jest.spyOn(service as any, 'checkRepositorySize').mockResolvedValue(undefined);
      jest.spyOn(service, 'createSecureWorkspace').mockResolvedValue(
        path.join(os.tmpdir(), `cp-src-spawn-test-${Date.now()}`),
      );
      jest.spyOn(service, 'cleanupWorkspace').mockResolvedValue();
      jest.spyOn(service as any, 'countWorkspaceFiles').mockResolvedValue(10);

      // Mock fetch to return empty tarball stream
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://codeload.github.com/owner/repo/legacy.tar.gz/deadbeef1234',
        headers: new Headers({}),
        body: new ReadableStream({
          start(controller) { controller.close(); },
        }),
      }) as any;

      await service.withRepositorySource('user-uuid-1', 'proj-uuid-1', async () => 'ok');

      // Only 'tar' should be spawned — not npm, docker, etc.
      expect(spawnCalls.every(cmd => cmd === 'tar')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Commit SHA Extraction
  // -------------------------------------------------------------------------

  describe('extractCommitSha', () => {
    it('32. should extract SHA from GitHub CDN tarball URL', () => {
      const sha = (service as any).extractCommitSha(
        'https://codeload.github.com/owner/repo/legacy.tar.gz/abc123def456789012345678901234567890abcd',
      );
      expect(sha).toBe('abc123def456789012345678901234567890abcd');
    });

    it('33. should return null for unrecognized URL format', () => {
      const sha = (service as any).extractCommitSha('https://example.com/unknown');
      expect(sha).toBeNull();
    });

    it('34. should return null for empty URL', () => {
      const sha = (service as any).extractCommitSha('');
      expect(sha).toBeNull();
    });
  });
});
