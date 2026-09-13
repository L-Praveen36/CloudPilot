import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  BadGatewayException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import {
  GitHubRepositoryDto,
  GitHubBranchDto,
  RepositoryListResponse,
  RepositoryDetailResponse,
  BranchListResponse,
  RepositoryPagination,
  RepositoryRateLimit,
} from '@cloudpilot/shared';
import { RepositoryQueryDto } from './dto/repository-query.dto';

@Injectable()
export class GitHubRepositoryService {
  private readonly logger = new Logger(GitHubRepositoryService.name);
  private readonly requestTimeoutMs = 10000; // 10-second timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Internal method to retrieve and decrypt the user's GitHub access token in memory.
   * Never exposed to controllers, DTOs, or logs.
   */
  async getDecryptedTokenForUser(userId: string): Promise<string> {
    const account = await this.prisma.gitHubAccount.findUnique({
      where: { userId },
    });

    if (!account || !account.accessToken) {
      throw new BadRequestException(
        'No connected GitHub account found for this user. Please authenticate with GitHub first.',
      );
    }

    try {
      return this.cryptoService.decrypt(account.accessToken);
    } catch {
      this.logger.error('Failed to decrypt stored GitHub access token in memory.');
      throw new UnauthorizedException('Failed to decrypt GitHub credentials');
    }
  }

  /**
   * Executes an authenticated HTTPS request to GitHub's REST API with a strict 10-second timeout.
   */
  private async fetchGitHub(
    url: string,
    accessToken: string,
  ): Promise<{ response: Response; data: any }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'CloudPilot-Repository-API',
        },
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        this.logger.warn('GitHub API request aborted due to 10-second timeout');
        throw new BadGatewayException('GitHub API request timed out after 10 seconds');
      }
      this.logger.warn('Failed to communicate with GitHub API network endpoint');
      throw new BadGatewayException('Failed to communicate with GitHub API');
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle error status codes from GitHub
    if (!response.ok) {
      this.handleGitHubError(response);
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      this.logger.warn('Failed to parse JSON response from GitHub API');
      throw new BadGatewayException('Received malformed response from GitHub API');
    }

    return { response, data };
  }

  /**
   * Sanitizes and maps GitHub HTTP error codes to appropriate NestJS exceptions.
   * Strips headers and secrets from any error payload.
   */
  private handleGitHubError(response: Response): never {
    const status = response.status;
    const remaining = response.headers.get('x-ratelimit-remaining');

    if (status === 401) {
      this.logger.warn('GitHub API returned 401 Unauthorized');
      throw new UnauthorizedException('GitHub authentication token is invalid or has expired');
    }

    if (status === 403) {
      if (remaining === '0') {
        this.logger.warn('GitHub API rate limit exceeded');
        throw new HttpException(
          'GitHub API rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.logger.warn('GitHub API returned 403 Forbidden');
      throw new ForbiddenException('Access to this GitHub repository or resource is forbidden');
    }

    if (status === 404) {
      this.logger.warn('GitHub API returned 404 Not Found');
      throw new NotFoundException('GitHub repository or resource not found');
    }

    if (status >= 500) {
      this.logger.warn(`GitHub API returned server error: HTTP ${status}`);
      throw new BadGatewayException('GitHub upstream service error');
    }

    this.logger.warn(`GitHub API request failed with HTTP ${status}`);
    throw new BadGatewayException('GitHub API request failed');
  }

  /**
   * Lists repositories accessible to the authenticated user with pagination.
   */
  async listRepositories(
    userId: string,
    query: RepositoryQueryDto,
  ): Promise<RepositoryListResponse> {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 30));

    const token = await this.getDecryptedTokenForUser(userId);

    const url = `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`;

    const { response, data } = await this.fetchGitHub(url, token);

    if (!Array.isArray(data)) {
      throw new BadGatewayException('Invalid response structure from GitHub repositories API');
    }

    const repositories: GitHubRepositoryDto[] = data.map((repo) => this.mapRepositoryDto(repo));
    const pagination = this.parsePagination(
      response.headers.get('link'),
      page,
      perPage,
      repositories.length,
    );
    const rateLimit = this.parseRateLimit(response);

    return {
      repositories,
      pagination,
      rateLimit,
    };
  }

  /**
   * Retrieves detail for a specific repository.
   */
  async getRepository(
    userId: string,
    owner: string,
    repo: string,
  ): Promise<RepositoryDetailResponse> {
    const token = await this.getDecryptedTokenForUser(userId);

    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repo);
    const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}`;

    const { response, data } = await this.fetchGitHub(url, token);

    const repository = this.mapRepositoryDto(data);
    const rateLimit = this.parseRateLimit(response);

    return {
      repository,
      rateLimit,
    };
  }

  /**
   * Lists branches for a specific repository with pagination.
   */
  async listBranches(
    userId: string,
    owner: string,
    repo: string,
    query: RepositoryQueryDto,
  ): Promise<BranchListResponse> {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 30));

    const token = await this.getDecryptedTokenForUser(userId);

    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repo);
    const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/branches?page=${page}&per_page=${perPage}`;

    const { response, data } = await this.fetchGitHub(url, token);

    if (!Array.isArray(data)) {
      throw new BadGatewayException('Invalid response structure from GitHub branches API');
    }

    const branches: GitHubBranchDto[] = data.map((branch) => this.mapBranchDto(branch));
    const pagination = this.parsePagination(
      response.headers.get('link'),
      page,
      perPage,
      branches.length,
    );
    const rateLimit = this.parseRateLimit(response);

    return {
      branches,
      pagination,
      rateLimit,
    };
  }

  /**
   * Retrieves the full file tree of a repository branch using GitHub Git Trees API.
   * Enables deep static analysis of project structure without cloning.
   */
  async getRepositoryTree(
    userId: string,
    owner: string,
    repo: string,
    branch: string = 'main',
  ): Promise<string[]> {
    const token = await this.getDecryptedTokenForUser(userId);
    const safeOwner = encodeURIComponent(owner.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    const safeBranch = encodeURIComponent(branch.trim());

    // 1. Try recursive Git Tree API
    const treeUrl = `https://api.github.com/repos/${safeOwner}/${safeRepo}/git/trees/${safeBranch}?recursive=1`;

    try {
      const { data } = await this.fetchGitHub(treeUrl, token);
      if (Array.isArray(data?.tree)) {
        return data.tree.map((item: any) => String(item.path || ''));
      }
    } catch (err: any) {
      this.logger.warn(`Recursive git tree fetch failed for ${owner}/${repo}, falling back to contents API: ${err.message}`);
    }

    // 2. Fallback: Query repository root contents
    try {
      const contentsUrl = `https://api.github.com/repos/${safeOwner}/${safeRepo}/contents?ref=${safeBranch}`;
      const { data } = await this.fetchGitHub(contentsUrl, token);
      if (Array.isArray(data)) {
        return data.map((item: any) => String(item.path || item.name || ''));
      }
    } catch (err: any) {
      this.logger.warn(`Contents fallback failed for ${owner}/${repo}: ${err.message}`);
    }

    return [];
  }

  /**
   * Retrieves and decodes the raw text content of a single file from the repository.
   * Returns null if the file does not exist.
   */
  async getRepositoryFileContent(
    userId: string,
    owner: string,
    repo: string,
    filePath: string,
    branch: string = 'main',
  ): Promise<string | null> {
    const token = await this.getDecryptedTokenForUser(userId);
    const safeOwner = encodeURIComponent(owner.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    const safePath = filePath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    const safeBranch = encodeURIComponent(branch.trim());

    const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/contents/${safePath}?ref=${safeBranch}`;

    try {
      const { data } = await this.fetchGitHub(url, token);
      if (data && data.content && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }
      if (typeof data === 'string') {
        return data;
      }
      return null;
    } catch (err: any) {
      if (err instanceof NotFoundException || err.status === 404) {
        return null;
      }
      this.logger.warn(`Could not retrieve file ${filePath} from ${owner}/${repo}: ${err.message}`);
      return null;
    }
  }

  /**
   * Transforms raw GitHub repository object into safe CloudPilot DTO.
   */
  mapRepositoryDto(raw: any): GitHubRepositoryDto {
    return {
      id: raw.id,
      name: raw.name,
      fullName: raw.full_name,
      description: raw.description || null,
      htmlUrl: raw.html_url,
      cloneUrl: raw.clone_url,
      sshUrl: raw.ssh_url,
      defaultBranch: raw.default_branch || 'main',
      private: Boolean(raw.private),
      fork: Boolean(raw.fork),
      language: raw.language || null,
      stars: Number(raw.stargazers_count) || 0,
      forks: Number(raw.forks_count) || 0,
      openIssues: Number(raw.open_issues_count) || 0,
      updatedAt: raw.updated_at || null,
      pushedAt: raw.pushed_at || null,
      owner: {
        login: raw.owner?.login || '',
        avatarUrl: raw.owner?.avatar_url || null,
      },
    };
  }

  /**
   * Transforms raw GitHub branch object into safe CloudPilot DTO.
   */
  mapBranchDto(raw: any): GitHubBranchDto {
    return {
      name: raw.name,
      sha: raw.commit?.sha || '',
      protected: Boolean(raw.protected),
    };
  }

  /**
   * Parses RFC 5988 Link header to determine pagination state.
   */
  private parsePagination(
    linkHeader: string | null,
    page: number,
    perPage: number,
    itemCount: number,
  ): RepositoryPagination {
    let hasNextPage = false;
    let hasPreviousPage = page > 1;

    if (linkHeader) {
      hasNextPage = linkHeader.includes('rel="next"');
      hasPreviousPage = linkHeader.includes('rel="prev"') || page > 1;
    } else {
      // Fallback if GitHub didn't provide Link header
      hasNextPage = itemCount === perPage;
    }

    return {
      page,
      perPage,
      hasNextPage,
      hasPreviousPage,
    };
  }

  /**
   * Safely extracts rate-limit metadata without exposing credentials or headers.
   */
  private parseRateLimit(response: Response): RepositoryRateLimit | undefined {
    const remainingHeader = response.headers.get('x-ratelimit-remaining');
    const resetHeader = response.headers.get('x-ratelimit-reset');

    if (!remainingHeader) {
      return undefined;
    }

    const remaining = parseInt(remainingHeader, 10);
    const resetAt = resetHeader
      ? new Date(parseInt(resetHeader, 10) * 1000).toISOString()
      : null;

    return {
      remaining: isNaN(remaining) ? 0 : remaining,
      resetAt,
    };
  }
}
