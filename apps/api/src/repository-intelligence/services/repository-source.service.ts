import {
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
  BadRequestException,
  RequestTimeoutException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import * as path from 'path';
import * as fsp from 'fs/promises';
import type { Dirent } from 'fs';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { PrismaService } from '../../prisma/prisma.service';
import { GitHubRepositoryService } from '../../github/github-repository.service';

// ---------------------------------------------------------------------------
// Internal contract — NEVER serialized to API responses or frontend DTOs.
// workspacePath must remain strictly server-side.
// ---------------------------------------------------------------------------
export interface RepositorySourceContext {
  readonly repositoryFullName: string;
  readonly branch: string;
  readonly commitSha: string | null;
  readonly fileCount: number;
  /** INTERNAL ONLY — never expose to frontend or logs */
  readonly workspacePath: string;
}

/** Sanitized acquisition metadata safe to return in API responses */
export interface SourceAcquisitionMetadata {
  readonly repositoryFullName: string;
  readonly branch: string;
  readonly commitSha: string | null;
  readonly fileCount: number;
}

/**
 * RepositorySourceService — Phase 3.1 Repository Source Acquisition
 *
 * Responsible for:
 *  - Validating project ownership
 *  - Downloading the authenticated GitHub tarball (Option A — archive download)
 *  - Creating a secure temporary workspace under os.tmpdir()
 *  - Extracting the archive with path-traversal protection
 *  - Providing a lifecycle-safe withRepositorySource() abstraction
 *  - Guaranteeing workspace cleanup on both success and failure
 *
 * NOT responsible for: framework detection, language analysis, deployment.
 *
 * WHY GitHub Tarball API over git clone:
 *   - The existing CloudPilot GitHub integration uses HTTPS fetch() with Bearer
 *     token headers. Tarball download uses identical credential handling.
 *   - No new binary dependency (git) required in the backend process.
 *   - OAuth token stays in an in-memory HTTPS Authorization header — never in
 *     CLI arguments (no process-listing exposure via `ps aux`).
 *   - GitHub tarball downloads produce history-free archives (no .git directory,
 *     no commit author emails in git objects).
 *   - Token is GC-eligible immediately after fetch() completes.
 *
 * Phase 3.2 integration seam:
 *   RepositoryAnalyzerService can call withRepositorySource() and receive a
 *   RepositorySourceContext.workspacePath to perform local file analysis
 *   in addition to or instead of the existing GitHub tree API inspection.
 */
@Injectable()
export class RepositorySourceService implements OnModuleInit {
  private readonly logger = new Logger(RepositorySourceService.name);

  // All limits are configurable via environment/config — not hard-coded inline.
  private readonly maxRepoSizeMb: number;
  private readonly maxFileCount: number;
  private readonly maxFileSizeMb: number;
  private readonly acquisitionTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubRepoService: GitHubRepositoryService,
    private readonly configService: ConfigService,
  ) {
    this.maxRepoSizeMb = Number(this.configService.get<string>('MAX_REPO_SIZE_MB') ?? 50);
    this.maxFileCount = Number(this.configService.get<string>('MAX_FILE_COUNT') ?? 10000);
    this.maxFileSizeMb = Number(this.configService.get<string>('MAX_FILE_SIZE_MB') ?? 10);
    this.acquisitionTimeoutMs = Number(
      this.configService.get<string>('SOURCE_ACQUISITION_TIMEOUT_MS') ?? 60000,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.cleanupOrphanedWorkspaces().catch((err) => {
      this.logger.warn(`Orphaned workspace cleanup encountered error: ${err.message}`);
    });
  }

  /**
   * Scans os.tmpdir() for old CloudPilot workspace directories (`cp-src-*`)
   * created over 1 hour ago and removes them to prevent disk leaks.
   */
  async cleanupOrphanedWorkspaces(): Promise<number> {
    const tmpDir = os.tmpdir();
    let cleaned = 0;
    try {
      const entries = await fsp.readdir(tmpDir, { withFileTypes: true });
      const oneHourAgo = Date.now() - 3600000;

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('cp-src-')) {
          const fullPath = path.join(tmpDir, entry.name);
          try {
            const stats = await fsp.stat(fullPath);
            if (stats.mtimeMs < oneHourAgo) {
              await fsp.rm(fullPath, { recursive: true, force: true });
              cleaned++;
            }
          } catch {}
        }
      }
      if (cleaned > 0) {
        this.logger.log(`Cleaned up ${cleaned} orphaned temporary workspaces.`);
      }
    } catch {}
    return cleaned;
  }

  /**
   * Lifecycle-safe source acquisition.
   *
   * Creates a temporary workspace, acquires repository source, invokes the
   * read-only consumer callback, and ALWAYS cleans up — even if the consumer
   * throws. The workspacePath is internal and never returned to callers.
   *
   * Usage:
   *   const metadata = await sourceService.withRepositorySource(
   *     userId,
   *     projectId,
   *     async (ctx) => { ... read ctx.workspacePath ... return metadata; },
   *   );
   */
  async withRepositorySource<T>(
    userId: string,
    projectId: string,
    consumer: (context: RepositorySourceContext) => Promise<T>,
  ): Promise<T> {
    // 1. Verify project ownership via persisted metadata only
    //    (never trust owner/name from the browser)
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.logger.log(
      `Starting source acquisition for ${project.repositoryFullName} (Project: ${projectId})`,
    );

    // 2. Check repository size before downloading
    await this.checkRepositorySize(userId, project.repositoryOwner, project.repositoryName);

    // 3. Create secure temporary workspace (outside application source tree)
    const workspacePath = await this.createSecureWorkspace();

    try {
      // 4. Download and extract the GitHub tarball
      const { commitSha, fileCount } = await this.acquireGitHubTarball(
        userId,
        project.repositoryOwner,
        project.repositoryName,
        project.defaultBranch || 'main',
        workspacePath,
      );

      this.logger.log(
        `Source acquired: ${project.repositoryFullName}@${commitSha ?? project.defaultBranch} — ${fileCount} files`,
      );

      const context: RepositorySourceContext = {
        repositoryFullName: project.repositoryFullName,
        branch: project.defaultBranch || 'main',
        commitSha,
        fileCount,
        workspacePath, // INTERNAL — never propagate to API responses
      };

      // 5. Invoke consumer (read-only analysis, etc.)
      return await consumer(context);
    } finally {
      // 6. Guaranteed cleanup — runs on success AND failure
      await this.cleanupWorkspace(workspacePath);
      this.logger.log(`Workspace cleaned up for Project ${projectId}`);
    }
  }

  /**
   * Checks the repository size via GitHub metadata API.
   * GitHub reports size in KB. Rejects if it exceeds MAX_REPO_SIZE_MB.
   */
  async checkRepositorySize(userId: string, owner: string, repo: string): Promise<void> {
    const safeOwner = encodeURIComponent(owner.trim());
    const safeRepo = encodeURIComponent(repo.trim());

    // Retrieve token only for this scoped check
    const token = await this.githubRepoService.getDecryptedTokenForUser(userId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(`https://api.github.com/repos/${safeOwner}/${safeRepo}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'CloudPilot-Source-Acquisition',
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new RequestTimeoutException('GitHub repository size check timed out');
      }
      throw new BadGatewayException('Failed to reach GitHub API for repository validation');
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404) {
      throw new NotFoundException('GitHub repository not found or not accessible');
    }
    if (!response.ok) {
      throw new BadGatewayException('GitHub repository validation failed');
    }

    let repoData: any;
    try {
      repoData = await response.json();
    } catch {
      throw new BadGatewayException('Failed to parse GitHub repository metadata');
    }

    // GitHub `size` field is in KiB
    const repoSizeKb = Number(repoData.size ?? 0);
    const repoSizeMb = repoSizeKb / 1024;

    if (repoSizeMb > this.maxRepoSizeMb) {
      throw new BadRequestException(
        `Repository size (${repoSizeMb.toFixed(1)} MB) exceeds the maximum allowed size of ${this.maxRepoSizeMb} MB`,
      );
    }
  }

  /**
   * Creates a secure temporary workspace directory under os.tmpdir().
   * The name is unpredictable (16 random bytes as hex).
   * The workspace has mode 0o700 (owner read/write/execute only).
   * NEVER created inside the CloudPilot application source tree.
   */
  async createSecureWorkspace(): Promise<string> {
    const randomSuffix = crypto.randomBytes(16).toString('hex');
    const workspaceName = `cp-src-${randomSuffix}`;
    const workspacePath = path.join(os.tmpdir(), workspaceName);

    await fsp.mkdir(workspacePath, { mode: 0o700, recursive: false });

    // Verify the created path is within tmpdir (double-check, not merely the join)
    const resolvedWorkspace = path.resolve(workspacePath);
    const resolvedTmpdir = path.resolve(os.tmpdir());
    if (!resolvedWorkspace.startsWith(resolvedTmpdir + path.sep)) {
      await fsp.rm(resolvedWorkspace, { recursive: true, force: true }).catch(() => {});
      throw new Error('SECURITY: Workspace path resolved outside temporary directory');
    }

    return workspacePath;
  }

  /**
   * Downloads the GitHub tarball for the repository/branch and extracts it
   * into the workspace using the system's `tar` command.
   *
   * Security measures:
   *  - OAuth token only exists in the HTTPS Authorization header in memory.
   *  - Token is never written to disk, CLI arguments, or logs.
   *  - tar is invoked via spawn() with an argument array (no shell interpretation).
   *  - --strip-components=1 removes GitHub's generated top-level directory prefix.
   *  - Streaming byte counter enforces MAX_REPO_SIZE_MB during download.
   *  - No repository code is executed at any point.
   */
  private async acquireGitHubTarball(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    workspacePath: string,
  ): Promise<{ commitSha: string | null; fileCount: number }> {
    // Input validation — prevent path traversal/injection via sanitized strings only
    if (!owner || !repo || !branch) {
      throw new BadRequestException('Repository owner, name, and branch are required');
    }
    if (owner.includes('..') || repo.includes('..') || branch.includes('..')) {
      throw new BadRequestException('Invalid repository parameters');
    }

    const safeOwner = encodeURIComponent(owner.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    const safeBranch = encodeURIComponent(branch.trim());

    // Decrypt token in-memory only — token string is not logged
    const token = await this.githubRepoService.getDecryptedTokenForUser(userId);

    const tarballUrl = `https://api.github.com/repos/${safeOwner}/${safeRepo}/tarball/${safeBranch}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.acquisitionTimeoutMs);

    let response: Response;
    try {
      response = await fetch(tarballUrl, {
        method: 'GET',
        headers: {
          // Token used only as in-memory Authorization header
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'CloudPilot-Source-Acquisition',
        },
        signal: controller.signal,
        redirect: 'follow', // Follow GitHub's 302 to CDN tarball
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new RequestTimeoutException(
          `Repository source acquisition timed out after ${this.acquisitionTimeoutMs / 1000}s`,
        );
      }
      throw new BadGatewayException('Failed to reach GitHub during source acquisition');
    } finally {
      clearTimeout(timeoutId);
    }
    // Token reference goes out of scope here — eligible for GC

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundException('GitHub repository or branch not found');
      }
      if (response.status === 401) {
        throw new BadGatewayException('GitHub authentication failed during source acquisition');
      }
      if (response.status === 403) {
        throw new BadGatewayException(
          'Access to the repository was denied during source acquisition',
        );
      }
      throw new BadGatewayException(
        `GitHub returned HTTP ${response.status} during source acquisition`,
      );
    }

    // Extract commit SHA from the final (redirected) URL — CDN URL contains 40-char SHA
    const commitSha = this.extractCommitSha(response.url);

    if (!response.body) {
      throw new BadGatewayException('GitHub returned empty response body for tarball download');
    }

    // Stream tarball into tar process; enforce size limit during transfer
    const fileCount = await this.streamExtractTarball(response.body, workspacePath);

    if (fileCount > this.maxFileCount) {
      throw new BadRequestException(
        `Repository contains too many files (${fileCount} > limit ${this.maxFileCount})`,
      );
    }

    return { commitSha, fileCount };
  }

  /**
   * Pipes the fetch response body stream into `tar` stdin for in-process extraction.
   * Uses spawn() with a fixed argument array — no shell string construction.
   * Returns the count of extracted files.
   */
  private streamExtractTarball(
    body: ReadableStream<Uint8Array>,
    workspacePath: string,
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const resolvedWorkspace = path.resolve(workspacePath);
      const resolvedTmpdir = path.resolve(os.tmpdir());

      // Safety guard: verify workspace is within tmpdir before extraction
      if (!resolvedWorkspace.startsWith(resolvedTmpdir + path.sep)) {
        reject(new Error('SECURITY: Refusing extraction — workspace outside tmpdir'));
        return;
      }

      // tar invoked via argument array — no shell=true, no string concatenation
      const tarProcess = spawn(
        'tar',
        [
          '-x', // extract
          '-z', // decompress gzip
          '-C', resolvedWorkspace, // change to verified workspace directory
          '--strip-components=1', // remove GitHub's generated repo-sha/ prefix
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false, // NEVER enable shell
        },
      );

      let tarError = '';

      tarProcess.stderr?.on('data', (data: Buffer) => {
        // Capture without logging (stderr may contain filesystem paths)
        tarError += data.toString().substring(0, 500);
      });

      tarProcess.on('error', (err: Error) => {
        reject(
          new BadGatewayException(
            `Failed to start archive extraction: ${err.message.includes('ENOENT') ? 'tar command not found' : 'tar process error'}`,
          ),
        );
      });

      tarProcess.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new BadGatewayException(`Repository archive extraction failed (tar exit code ${code})`));
          return;
        }

        // Count extracted files after successful extraction
        this.countWorkspaceFiles(resolvedWorkspace)
          .then((count) => resolve(count))
          .catch(reject);
      });

      // Pipe fetch body ReadableStream into tar's stdin with byte limit enforcement
      const maxBytes = this.maxRepoSizeMb * 1024 * 1024;
      let totalBytes = 0;
      let pipeAborted = false;

      const reader = body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalBytes += value.length;

            if (totalBytes > maxBytes) {
              pipeAborted = true;
              tarProcess.kill('SIGKILL');
              reject(
                new BadRequestException(
                  `Repository archive exceeds ${this.maxRepoSizeMb} MB size limit during download`,
                ),
              );
              return;
            }

            // Write chunk; back-pressure via drain event
            const canContinue = tarProcess.stdin!.write(value);
            if (!canContinue) {
              await new Promise<void>((r) => tarProcess.stdin!.once('drain', r));
            }
          }

          if (!pipeAborted) {
            tarProcess.stdin!.end();
          }
        } catch (err: any) {
          if (!pipeAborted) {
            tarProcess.kill('SIGKILL');
            reject(new BadGatewayException('Stream interrupted during repository archive download'));
          }
        }
      };

      pump();
    });
  }

  /**
   * Counts the total number of entries (files + directories) in the workspace.
   * Used to enforce MAX_FILE_COUNT limit after extraction.
   */
  async countWorkspaceFiles(workspacePath: string): Promise<number> {
    let count = 0;
    const walk = async (dir: string, depth = 0): Promise<void> => {
      // Depth limit as additional safety measure
      if (depth > 50 || count >= this.maxFileCount + 1) return;

      let entries: Dirent[];
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (count >= this.maxFileCount + 1) break;
        count++;

        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          await walk(path.join(dir, entry.name), depth + 1);
        }
      }
    };

    await walk(workspacePath);
    return count;
  }

  /**
   * Extracts the commit SHA from the GitHub CDN tarball URL.
   * The redirect URL typically contains the 40-character commit SHA.
   * e.g. https://codeload.github.com/owner/repo/legacy.tar.gz/refs/heads/main
   *   or https://codeload.github.com/owner/repo/legacy.tar.gz/<sha>
   */
  private extractCommitSha(finalUrl: string): string | null {
    if (!finalUrl) return null;
    try {
      // Pattern: 40 lowercase hex chars at end of URL segment
      const match = finalUrl.match(/\/([0-9a-f]{40})(?:\.tar\.gz)?(?:[/?#]|$)/);
      if (match) return match[1];
    } catch {
      // Non-fatal — commitSha is informational metadata
    }
    return null;
  }

  /**
   * Safely removes the temporary workspace.
   * Validates workspace is within os.tmpdir() before deletion.
   * Failure is logged but not re-thrown (to avoid masking upstream errors).
   */
  async cleanupWorkspace(workspacePath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(workspacePath);
      const resolvedTmpdir = path.resolve(os.tmpdir());

      // Safety check: never delete paths outside tmpdir
      if (!resolvedPath.startsWith(resolvedTmpdir + path.sep)) {
        this.logger.error('SECURITY: Refusing to delete workspace — path is outside tmpdir');
        return;
      }

      await fsp.rm(resolvedPath, { recursive: true, force: true });
    } catch (err: any) {
      // Sanitize error message — workspace paths should not leak into logs
      this.logger.warn('Failed to cleanup workspace (non-fatal): cleanup will be retried or handled by OS temp cleanup');
    }
  }
}
