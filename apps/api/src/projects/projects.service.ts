import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubRepositoryService } from '../github/github-repository.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectDto } from '@cloudpilot/shared';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubRepoService: GitHubRepositoryService,
  ) {}

  /**
   * Connects a GitHub repository to the user's account and persists it as a Project.
   * Performs server-side GitHub repository verification and duplicate check.
   */
  async createProject(userId: string, dto: CreateProjectDto): Promise<ProjectDto> {
    // 1. Verify that the repository is accessible to the authenticated user on GitHub
    const repoDetail = await this.githubRepoService.getRepository(
      userId,
      dto.repositoryOwner,
      dto.repositoryName,
    );

    const githubRepo = repoDetail.repository;
    if (!githubRepo) {
      throw new BadRequestException('Failed to retrieve repository from GitHub');
    }

    // Confirm that the repository ID matches the verified GitHub repository
    if (githubRepo.id !== dto.githubRepositoryId) {
      throw new BadRequestException(
        'GitHub repository ID does not match the specified repository owner and name.',
      );
    }

    // 2. Duplicate Check: Ensure user hasn't already connected this repository
    const existing = await this.prisma.project.findUnique({
      where: {
        userId_githubRepositoryId: {
          userId,
          githubRepositoryId: dto.githubRepositoryId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Repository is already connected to this account');
    }

    // 3. Persist Project in PostgreSQL
    const project = await this.prisma.project.create({
      data: {
        userId,
        githubRepositoryId: githubRepo.id,
        repositoryOwner: githubRepo.owner.login,
        repositoryName: githubRepo.name,
        repositoryFullName: githubRepo.fullName,
        defaultBranch: githubRepo.defaultBranch || 'main',
        private: githubRepo.private,
        cloneUrl: githubRepo.cloneUrl,
        htmlUrl: githubRepo.htmlUrl,
        status: 'CONNECTED',
      },
    });

    this.logger.log(`Project successfully created: ${project.repositoryFullName} (ID: ${project.id})`);
    return this.mapProjectDto(project);
  }

  /**
   * Lists all projects belonging to the authenticated user.
   */
  async listProjects(userId: string): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => this.mapProjectDto(p));
  }

  /**
   * Retrieves detail for a specific project.
   * Enforces strict user ownership; returns 404 if not found or belongs to another user.
   */
  async getProject(userId: string, projectId: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.mapProjectDto(project);
  }

  /**
   * Deletes (disconnects) a project from CloudPilot.
   * Enforces strict user ownership; returns 404 if not found or belongs to another user.
   */
  async deleteProject(
    userId: string,
    projectId: string,
  ): Promise<{ success: boolean; message: string }> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    this.logger.log(
      `Project successfully disconnected: ${project.repositoryFullName} (ID: ${projectId})`,
    );

    return {
      success: true,
      message: 'Project disconnected successfully',
    };
  }

  /**
   * Transforms raw Prisma project record into sanitized ProjectDto.
   */
  private mapProjectDto(raw: any): ProjectDto {
    return {
      id: raw.id,
      userId: raw.userId,
      githubRepositoryId: raw.githubRepositoryId,
      repositoryOwner: raw.repositoryOwner,
      repositoryName: raw.repositoryName,
      repositoryFullName: raw.repositoryFullName,
      defaultBranch: raw.defaultBranch,
      private: Boolean(raw.private),
      cloneUrl: raw.cloneUrl,
      htmlUrl: raw.htmlUrl,
      status: raw.status,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : String(raw.updatedAt),
    };
  }
}
