export interface GitHubRepositoryOwnerDto {
  login: string;
  avatarUrl: string | null;
}

export interface GitHubRepositoryDto {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  private: boolean;
  fork: boolean;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  updatedAt: string | null;
  pushedAt: string | null;
  owner: GitHubRepositoryOwnerDto;
}

export interface GitHubBranchDto {
  name: string;
  sha: string;
  protected: boolean;
}

export interface RepositoryPagination {
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RepositoryRateLimit {
  remaining: number;
  resetAt: string | null;
}

export interface RepositoryListResponse {
  repositories: GitHubRepositoryDto[];
  pagination: RepositoryPagination;
  rateLimit?: RepositoryRateLimit;
}

export interface RepositoryDetailResponse {
  repository: GitHubRepositoryDto;
  rateLimit?: RepositoryRateLimit;
}

export interface BranchListResponse {
  branches: GitHubBranchDto[];
  pagination: RepositoryPagination;
  rateLimit?: RepositoryRateLimit;
}
