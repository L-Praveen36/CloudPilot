import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
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
  ProjectListResponse,
  ProjectDetailResponse,
  DeleteProjectResponse,
} from '@cloudpilot/shared';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectIdDto } from './dto/project-id.dto';

@Controller('projects')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * POST /projects
   * Creates/connects a GitHub repository as a persistent project.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @CurrentUser() user: UserDto,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDetailResponse> {
    const project = await this.projectsService.createProject(user.id, dto);
    return { project };
  }

  /**
   * GET /projects
   * Lists all projects belonging to the authenticated user.
   */
  @Get()
  async listProjects(@CurrentUser() user: UserDto): Promise<ProjectListResponse> {
    const projects = await this.projectsService.listProjects(user.id);
    return { projects };
  }

  /**
   * GET /projects/:id
   * Retrieves detail for a specific project.
   */
  @Get(':id')
  async getProject(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<ProjectDetailResponse> {
    const project = await this.projectsService.getProject(user.id, params.id);
    return { project };
  }

  /**
   * DELETE /projects/:id
   * Disconnects/deletes a project from CloudPilot.
   */
  @Delete(':id')
  async deleteProject(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<DeleteProjectResponse> {
    return this.projectsService.deleteProject(user.id, params.id);
  }
}
