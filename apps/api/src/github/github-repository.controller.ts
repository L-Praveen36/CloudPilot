import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDto } from '@cloudpilot/shared';
import { GitHubRepositoryService } from './github-repository.service';
import { RepositoryQueryDto } from './dto/repository-query.dto';
import { RepositoryParamsDto } from './dto/repository-params.dto';
import {
  RepositoryListResponse,
  RepositoryDetailResponse,
  BranchListResponse,
} from '@cloudpilot/shared';

@Controller('github/repositories')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GitHubRepositoryController {
  constructor(private readonly githubRepoService: GitHubRepositoryService) {}

  /**
   * GET /github/repositories
   * Lists repositories for the authenticated user with pagination.
   */
  @Get()
  async listRepositories(
    @CurrentUser() user: UserDto,
    @Query() query: RepositoryQueryDto,
  ): Promise<RepositoryListResponse> {
    return this.githubRepoService.listRepositories(user.id, query);
  }

  /**
   * GET /github/repositories/:owner/:repo
   * Retrieves single repository details.
   */
  @Get(':owner/:repo')
  async getRepository(
    @CurrentUser() user: UserDto,
    @Param() params: RepositoryParamsDto,
  ): Promise<RepositoryDetailResponse> {
    return this.githubRepoService.getRepository(user.id, params.owner, params.repo);
  }

  /**
   * GET /github/repositories/:owner/:repo/branches
   * Lists branches for a specific repository with pagination.
   */
  @Get(':owner/:repo/branches')
  async listBranches(
    @CurrentUser() user: UserDto,
    @Param() params: RepositoryParamsDto,
    @Query() query: RepositoryQueryDto,
  ): Promise<BranchListResponse> {
    return this.githubRepoService.listBranches(
      user.id,
      params.owner,
      params.repo,
      query,
    );
  }
}
