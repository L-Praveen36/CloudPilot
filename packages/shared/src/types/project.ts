export type ProjectStatus = 'CONNECTED' | 'DISCONNECTED';

export interface ProjectDto {
  id: string;
  userId: string;
  githubRepositoryId: number;
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;
  defaultBranch: string;
  private: boolean;
  cloneUrl: string;
  htmlUrl: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  githubRepositoryId: number;
  repositoryOwner: string;
  repositoryName: string;
}

export interface ProjectListResponse {
  projects: ProjectDto[];
}

export interface ProjectDetailResponse {
  project: ProjectDto;
}

export interface DeleteProjectResponse {
  success: boolean;
  message: string;
}
