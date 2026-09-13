import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UserDto,
  RepositoryAnalysisResponse,
  ApplicationStructureResponse,
  DeploymentReadinessResponse,
} from '@cloudpilot/shared';
import { RepositoryIntelligenceService } from './repository-intelligence.service';
import { ProjectIdDto } from '../projects/dto/project-id.dto';
import { SourceAcquisitionMetadata } from './services/repository-source.service';

/** Sanitized API response for source acquisition — workspacePath intentionally absent */
export interface SourceAcquisitionResponse {
  acquisition: {
    status: 'success';
    repositoryFullName: string;
    branch: string;
    commitSha: string | null;
    fileCount: number;
  };
}

@Controller('projects/:id')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RepositoryIntelligenceController {
  constructor(private readonly intelligenceService: RepositoryIntelligenceService) {}

  /**
   * POST /projects/:id/analyze
   * Triggers static repository intelligence analysis on the connected project.
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeProject(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<RepositoryAnalysisResponse> {
    const analysis = await this.intelligenceService.analyzeProject(user.id, params.id);
    return { analysis };
  }

  /**
   * GET /projects/:id/analysis
   * Retrieves the latest stored static analysis for the connected project.
   */
  @Get('analysis')
  async getProjectAnalysis(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<RepositoryAnalysisResponse> {
    const analysis = await this.intelligenceService.getProjectAnalysis(user.id, params.id);
    return { analysis };
  }

  /**
   * POST /projects/:id/analyze-structure
   *
   * Phase 3.3 — Application Structure Detection
   */
  @Post('analyze-structure')
  @HttpCode(HttpStatus.OK)
  async analyzeProjectStructure(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<ApplicationStructureResponse> {
    const structure = await this.intelligenceService.detectApplicationStructure(
      user.id,
      params.id,
    );
    return { structure };
  }

  /**
   * GET /projects/:id/structure
   *
   * Phase 3.3 — Retrieve Stored Application Structure
   */
  @Get('structure')
  async getProjectStructure(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<ApplicationStructureResponse> {
    const structure = await this.intelligenceService.getProjectStructure(user.id, params.id);
    return { structure };
  }

  /**
   * POST /projects/:id/analyze-readiness
   *
   * Phase 3.4 — Deployment Readiness Analysis
   */
  @Post('analyze-readiness')
  @HttpCode(HttpStatus.OK)
  async analyzeProjectReadiness(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<DeploymentReadinessResponse> {
    const readiness = await this.intelligenceService.analyzeProjectReadiness(
      user.id,
      params.id,
    );
    return { readiness };
  }

  /**
   * GET /projects/:id/readiness
   *
   * Phase 3.4 — Retrieve Stored Deployment Readiness
   */
  @Get('readiness')
  async getProjectReadiness(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<DeploymentReadinessResponse> {
    const readiness = await this.intelligenceService.getProjectReadiness(user.id, params.id);
    return { readiness };
  }

  /**
   * POST /projects/:id/acquire-source
   *
   * Phase 3.1 — Repository Source Acquisition
   */
  @Post('acquire-source')
  @HttpCode(HttpStatus.OK)
  async acquireProjectSource(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<SourceAcquisitionResponse> {
    const metadata: SourceAcquisitionMetadata = await this.intelligenceService.acquireProjectSource(
      user.id,
      params.id,
    );

    return {
      acquisition: {
        status: 'success',
        repositoryFullName: metadata.repositoryFullName,
        branch: metadata.branch,
        commitSha: metadata.commitSha,
        fileCount: metadata.fileCount,
      },
    };
  }
}
