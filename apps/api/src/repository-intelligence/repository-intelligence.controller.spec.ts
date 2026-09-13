import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { RepositoryIntelligenceController, SourceAcquisitionResponse } from './repository-intelligence.controller';
import { RepositoryIntelligenceService } from './repository-intelligence.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthService } from '../auth/auth.service';
import {
  UserDto,
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
} from '@cloudpilot/shared';
import { SourceAcquisitionMetadata } from './services/repository-source.service';

describe('RepositoryIntelligenceController', () => {
  let controller: RepositoryIntelligenceController;
  let service: RepositoryIntelligenceService;
  let authGuard: AuthGuard;

  const mockUser: UserDto = {
    id: 'user-auth-uuid-1',
    githubId: '987654',
    username: 'cloudpilot_user',
    email: 'user@cloudpilot.io',
    name: 'CloudPilot User',
    avatarUrl: 'https://avatar.com/user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStructure: ApplicationStructureDto = {
    primaryRole: 'FULLSTACK',
    confidence: 'HIGH',
    applications: [
      {
        name: 'web',
        path: 'apps/web',
        role: 'FRONTEND',
        framework: 'Next.js',
        language: 'TypeScript',
        packageManager: 'pnpm',
        entryPoint: { path: 'apps/web/app/page.tsx', isDefault: true, evidence: 'Next.js root page' },
        buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
        startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
        port: { port: 3000, source: '.env.example', confidence: 'HIGH' },
        outputDirectory: { path: '.next', isConfigured: false, source: 'Next.js convention' },
        confidence: 'HIGH',
        evidence: ['Next.js framework'],
      },
    ],
    relationships: [],
    topLevelEntryPoint: { path: 'apps/web/app/page.tsx', isDefault: true, evidence: 'Next.js root page' },
    topLevelBuildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
    topLevelStartCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
    topLevelPort: { port: 3000, source: '.env.example', confidence: 'HIGH' },
    topLevelOutputDirectory: { path: '.next', isConfigured: false, source: 'Next.js convention' },
    evidence: ['Next.js framework'],
  };

  const mockReadiness: DeploymentReadinessDto = {
    status: 'READY',
    score: 100,
    strategy: 'NODE_APPLICATION',
    summary: 'Repository is fully ready for deployment.',
    blockers: [],
    warnings: [],
    requirements: [],
    recommendations: [],
    scoreBreakdown: {
      applicationIdentity: 15,
      buildReadiness: 20,
      runtimeReadiness: 20,
      portReadiness: 15,
      outputArtifactReadiness: 10,
      environmentConfiguration: 10,
      deploymentStrategy: 10,
    },
  };

  const mockAnalysis: RepositoryAnalysisDto = {
    id: 'analysis-uuid-1',
    projectId: 'proj-uuid-1',
    projectType: 'WEB_APPLICATION',
    primaryLanguage: 'TypeScript',
    framework: 'Next.js',
    packageManager: 'npm',
    isMonorepo: false,
    hasDockerfile: false,
    hasDockerCompose: false,
    hasEnvExample: true,
    detectedFiles: ['package.json', 'tsconfig.json', 'next.config.ts'],
    analysisVersion: '2.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockAcquisitionMetadata: SourceAcquisitionMetadata = {
    repositoryFullName: 'cloudpilot/cloudpilot-core',
    branch: 'main',
    commitSha: 'deadbeef12345678901234567890123456789012',
    fileCount: 142,
  };

  beforeEach(async () => {
    const mockIntelligenceService = {
      analyzeProject: jest.fn().mockResolvedValue(mockAnalysis),
      getProjectAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      acquireProjectSource: jest.fn().mockResolvedValue(mockAcquisitionMetadata),
      detectApplicationStructure: jest.fn().mockResolvedValue(mockStructure),
      getProjectStructure: jest.fn().mockResolvedValue(mockStructure),
      analyzeProjectReadiness: jest.fn().mockResolvedValue(mockReadiness),
      getProjectReadiness: jest.fn().mockResolvedValue(mockReadiness),
    };

    const mockAuthService = {
      validateSession: jest.fn((token) => {
        if (token === 'valid_session') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositoryIntelligenceController],
      providers: [
        { provide: RepositoryIntelligenceService, useValue: mockIntelligenceService },
        { provide: AuthService, useValue: mockAuthService },
        AuthGuard,
      ],
    }).compile();

    controller = module.get<RepositoryIntelligenceController>(RepositoryIntelligenceController);
    service = module.get<RepositoryIntelligenceService>(RepositoryIntelligenceService);
    authGuard = module.get<AuthGuard>(AuthGuard);
  });

  // -------------------------------------------------------------------------
  // Auth Guard
  // -------------------------------------------------------------------------

  describe('AuthGuard on RepositoryIntelligenceController', () => {
    it('should throw UnauthorizedException on unauthenticated request to analyze', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {}, headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  // Existing Controller Handlers (preserved)
  // -------------------------------------------------------------------------

  describe('Controller Handlers', () => {
    it('should call analyzeProject with user ID and project ID param', async () => {
      const result = await controller.analyzeProject(mockUser, { id: 'proj-uuid-1' });

      expect(service.analyzeProject).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.analysis.projectType).toBe('WEB_APPLICATION');
      expect(result.analysis.framework).toBe('Next.js');
    });

    it('should call getProjectAnalysis with user ID and project ID param', async () => {
      const result = await controller.getProjectAnalysis(mockUser, { id: 'proj-uuid-1' });

      expect(service.getProjectAnalysis).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.analysis.primaryLanguage).toBe('TypeScript');
    });
  });

  // -------------------------------------------------------------------------
  // Phase 3.3 — Structure Endpoints
  // -------------------------------------------------------------------------

  describe('Phase 3.3 Structure Endpoints', () => {
    it('7. POST /projects/:id/analyze-structure should call detectApplicationStructure and return structure', async () => {
      const result = await controller.analyzeProjectStructure(mockUser, { id: 'proj-uuid-1' });

      expect(service.detectApplicationStructure).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.structure.primaryRole).toBe('FULLSTACK');
      expect(result.structure.applications[0].name).toBe('web');
      expect(result.structure.topLevelPort?.port).toBe(3000);
    });

    it('8. GET /projects/:id/structure should call getProjectStructure and return stored structure', async () => {
      const result = await controller.getProjectStructure(mockUser, { id: 'proj-uuid-1' });

      expect(service.getProjectStructure).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.structure.primaryRole).toBe('FULLSTACK');
    });

    it('9. GET /projects/:id/structure should propagate 404 when structure not found', async () => {
      (service.getProjectStructure as jest.Mock).mockRejectedValue(
        new NotFoundException('Application structure not found for this project'),
      );

      await expect(controller.getProjectStructure(mockUser, { id: 'proj-uuid-1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Phase 3.4 — Readiness Endpoints
  // -------------------------------------------------------------------------

  describe('Phase 3.4 Readiness Endpoints', () => {
    it('10. POST /projects/:id/analyze-readiness should call analyzeProjectReadiness and return readiness DTO', async () => {
      const result = await controller.analyzeProjectReadiness(mockUser, { id: 'proj-uuid-1' });

      expect(service.analyzeProjectReadiness).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.readiness.status).toBe('READY');
      expect(result.readiness.strategy).toBe('NODE_APPLICATION');
      expect(result.readiness.score).toBe(100);
    });

    it('11. GET /projects/:id/readiness should call getProjectReadiness and return stored readiness', async () => {
      const result = await controller.getProjectReadiness(mockUser, { id: 'proj-uuid-1' });

      expect(service.getProjectReadiness).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.readiness.status).toBe('READY');
    });

    it('12. GET /projects/:id/readiness should propagate 404 when readiness not found', async () => {
      (service.getProjectReadiness as jest.Mock).mockRejectedValue(
        new NotFoundException('Deployment readiness not found for this project'),
      );

      await expect(controller.getProjectReadiness(mockUser, { id: 'proj-uuid-1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Phase 3.1 — acquireProjectSource endpoint tests
  // -------------------------------------------------------------------------

  describe('POST /projects/:id/acquire-source', () => {
    it('1. should call acquireProjectSource with user ID and project ID', async () => {
      const result = await controller.acquireProjectSource(mockUser, { id: 'proj-uuid-1' });

      expect(service.acquireProjectSource).toHaveBeenCalledWith('user-auth-uuid-1', 'proj-uuid-1');
      expect(result.acquisition.status).toBe('success');
    });

    it('2. response must include repositoryFullName, branch, commitSha, fileCount', async () => {
      const result = await controller.acquireProjectSource(mockUser, { id: 'proj-uuid-1' });

      expect(result.acquisition.repositoryFullName).toBe('cloudpilot/cloudpilot-core');
      expect(result.acquisition.branch).toBe('main');
      expect(result.acquisition.commitSha).toBe('deadbeef12345678901234567890123456789012');
      expect(result.acquisition.fileCount).toBe(142);
    });

    it('3. response must NEVER contain workspacePath', async () => {
      const result = await controller.acquireProjectSource(mockUser, { id: 'proj-uuid-1' });
      const responseStr = JSON.stringify(result);

      expect(responseStr).not.toContain('workspacePath');
      expect(responseStr).not.toContain('/tmp/');
      expect(responseStr).not.toContain('cp-src-');
    });

    it('4. response must NEVER contain OAuth token or credentials', async () => {
      const result = await controller.acquireProjectSource(mockUser, { id: 'proj-uuid-1' });
      const responseStr = JSON.stringify(result);

      expect(responseStr).not.toContain('token');
      expect(responseStr).not.toContain('accessToken');
      expect(responseStr).not.toContain('secret');
      expect(responseStr).not.toContain('password');
      expect(responseStr).not.toContain('encryptionKey');
    });

    it('5. should propagate NotFoundException when project not found or cross-user', async () => {
      (service.acquireProjectSource as jest.Mock).mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.acquireProjectSource(mockUser, { id: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('6. handles null commitSha correctly in response', async () => {
      (service.acquireProjectSource as jest.Mock).mockResolvedValue({
        repositoryFullName: 'cloudpilot/cloudpilot-core',
        branch: 'main',
        commitSha: null,
        fileCount: 88,
      });

      const result = await controller.acquireProjectSource(mockUser, { id: 'proj-uuid-1' });

      expect(result.acquisition.commitSha).toBeNull();
      expect(result.acquisition.fileCount).toBe(88);
    });
  });
});
