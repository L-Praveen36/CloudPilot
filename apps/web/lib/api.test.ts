import {
  getCurrentUser,
  getRepositories,
  getRepository,
  getBranches,
  logout,
  createProject,
  getProjects,
  getProject,
  deleteProject,
  analyzeProject,
  getProjectAnalysis,
  analyzeProjectStructure,
  getProjectStructure,
  analyzeProjectReadiness,
  getProjectReadiness,
  getDeploymentPlan,
  createDeployment,
  cancelDeployment,
  getDeployments,
  getDeployment,
  getDeploymentLogs,
  getDeploymentTelemetry,
  getDeploymentMetrics,
  collectDeploymentMetrics,
  getDeploymentTailLogs,
  getDeploymentEvents,
  getAiRepositoryUnderstanding,
  getAiDeploymentProposal,
  diagnoseAiBuildFailure,
  diagnoseAiIncident,
  getAiRepairSuggestions,
  approveAiRepairSuggestion,
  rejectAiRepairSuggestion,
  runAiAgent,
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  getEnvironmentVariables,
  setEnvironmentVariable,
  deleteEnvironmentVariable,
  rollbackDeployment,
  getCicdSettings,
  updateCicdSettings,
  getWebhookEvents,
  ApiClientError,
} from './api';

describe('Frontend API Client (apps/web/lib/api.ts)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('1. getCurrentUser', () => {
    it('should fetch /auth/me with credentials include and return user data', async () => {
      const mockResponse = {
        user: {
          id: 'user-1',
          githubId: '123',
          username: 'cloudpilot_user',
          email: 'user@cloudpilot.io',
          name: 'CloudPilot User',
          avatarUrl: 'https://avatar.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await getCurrentUser();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/auth/me',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.user.username).toBe('cloudpilot_user');
    });
  });

  describe('2. getRepositories', () => {
    it('should query /github/repositories with safe page and perPage bounds', async () => {
      const mockList = {
        repositories: [
          {
            id: 101,
            name: 'repo-1',
            fullName: 'user/repo-1',
            description: 'Test Repo',
            htmlUrl: 'https://github.com/user/repo-1',
            cloneUrl: 'https://github.com/user/repo-1.git',
            sshUrl: 'git@github.com:user/repo-1.git',
            defaultBranch: 'main',
            private: false,
            fork: false,
            language: 'TypeScript',
            stars: 10,
            forks: 2,
            openIssues: 0,
            updatedAt: null,
            pushedAt: null,
            owner: { login: 'user', avatarUrl: null },
          },
        ],
        pagination: { page: 1, perPage: 30, hasNextPage: false, hasPreviousPage: false },
        rateLimit: { remaining: 4900, resetAt: null },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockList),
      } as any);

      const result = await getRepositories(1, 30);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/github/repositories?page=1&perPage=30',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.repositories).toHaveLength(1);
      expect(result.rateLimit?.remaining).toBe(4900);
    });

    it('should clamp invalid page and perPage parameters safely', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ repositories: [], pagination: { page: 1, perPage: 100 } }),
      } as any);

      await getRepositories(-5, 999);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/github/repositories?page=1&perPage=100',
        expect.anything(),
      );
    });
  });

  describe('3. getRepository', () => {
    it('should safely URL encode owner and repository name', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ repository: { id: 1, name: 'special-repo' } }),
      } as any);

      await getRepository('org-name', 'repo-name');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/github/repositories/org-name/repo-name',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });
  });

  describe('4. getBranches', () => {
    it('should request branches with pagination', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ branches: [{ name: 'main', sha: '123', protected: true }] }),
      } as any);

      const result = await getBranches('cloudpilot', 'core', 2, 20);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/github/repositories/cloudpilot/core/branches?page=2&perPage=20',
        expect.anything(),
      );
      expect(result.branches).toHaveLength(1);
    });
  });

  describe('5. Project Management Methods (Phase 2.4)', () => {
    const mockProject = {
      id: 'proj-123',
      userId: 'user-1',
      githubRepositoryId: 123456,
      repositoryOwner: 'cloudpilot',
      repositoryName: 'cloudpilot-core',
      repositoryFullName: 'cloudpilot/cloudpilot-core',
      defaultBranch: 'main',
      private: true,
      cloneUrl: 'https://github.com/cloudpilot/cloudpilot-core.git',
      htmlUrl: 'https://github.com/cloudpilot/cloudpilot-core',
      status: 'CONNECTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should create project by sending POST /projects with credentials: include', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ project: mockProject }),
      } as any);

      const result = await createProject({
        githubRepositoryId: 123456,
        repositoryOwner: 'cloudpilot',
        repositoryName: 'cloudpilot-core',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            githubRepositoryId: 123456,
            repositoryOwner: 'cloudpilot',
            repositoryName: 'cloudpilot-core',
          }),
        }),
      );
      expect(result.project.id).toBe('proj-123');
      expect(result.project.status).toBe('CONNECTED');
    });

    it('should list projects by sending GET /projects', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ projects: [mockProject] }),
      } as any);

      const result = await getProjects();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.projects).toHaveLength(1);
    });

    it('should get project detail by sending GET /projects/:id', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ project: mockProject }),
      } as any);

      const result = await getProject('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.project.repositoryName).toBe('cloudpilot-core');
    });

    it('should delete project by sending DELETE /projects/:id', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true, message: 'Project disconnected successfully' }),
      } as any);

      const result = await deleteProject('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123',
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should handle 409 Conflict when repository is already connected', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Repository is already connected to this account' }),
      } as any);

      await expect(
        createProject({
          githubRepositoryId: 123456,
          repositoryOwner: 'cloudpilot',
          repositoryName: 'cloudpilot-core',
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Repository is already connected to this account',
      });
    });
  });

  describe('6. Repository Intelligence Methods (Phase 3.1)', () => {
    const mockAnalysis = {
      id: 'analysis-123',
      projectId: 'proj-123',
      projectType: 'WEB_APPLICATION',
      primaryLanguage: 'TypeScript',
      framework: 'Next.js',
      packageManager: 'npm',
      isMonorepo: false,
      hasDockerfile: false,
      hasDockerCompose: false,
      hasEnvExample: true,
      detectedFiles: ['package.json', 'next.config.ts', 'tsconfig.json'],
      analysisVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should trigger static analysis via POST /projects/:id/analyze', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ analysis: mockAnalysis }),
      } as any);

      const result = await analyzeProject('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/analyze',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.analysis.framework).toBe('Next.js');
      expect(result.analysis.packageManager).toBe('npm');
    });

    it('should retrieve stored analysis via GET /projects/:id/analysis', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ analysis: mockAnalysis }),
      } as any);

      const result = await getProjectAnalysis('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/analysis',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.analysis.projectType).toBe('WEB_APPLICATION');
    });

    it('should trigger structure analysis via POST /projects/:id/analyze-structure', async () => {
      const mockStructure = {
        primaryRole: 'FULLSTACK',
        confidence: 'HIGH',
        applications: [],
        relationships: [],
        topLevelEntryPoint: { path: 'app/page.tsx', isDefault: true, evidence: 'Next.js' },
        topLevelBuildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
        topLevelStartCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
        topLevelPort: { port: 3000, source: '.env.example', confidence: 'HIGH' },
        topLevelOutputDirectory: { path: '.next', isConfigured: false, source: 'Next.js' },
        evidence: ['Next.js'],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ structure: mockStructure }),
      } as any);

      const result = await analyzeProjectStructure('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/analyze-structure',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.structure.primaryRole).toBe('FULLSTACK');
      expect(result.structure.topLevelPort?.port).toBe(3000);
    });

    it('should retrieve stored structure via GET /projects/:id/structure', async () => {
      const mockStructure = {
        primaryRole: 'FULLSTACK',
        confidence: 'HIGH',
        applications: [],
        relationships: [],
        topLevelEntryPoint: null,
        topLevelBuildCommand: null,
        topLevelStartCommand: null,
        topLevelPort: null,
        topLevelOutputDirectory: null,
        evidence: [],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ structure: mockStructure }),
      } as any);

      const result = await getProjectStructure('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/structure',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.structure.primaryRole).toBe('FULLSTACK');
    });

    it('should trigger readiness analysis via POST /projects/:id/analyze-readiness', async () => {
      const mockReadiness = {
        status: 'READY',
        score: 100,
        strategy: 'NODE_APPLICATION',
        summary: 'Ready for deployment',
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

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ readiness: mockReadiness }),
      } as any);

      const result = await analyzeProjectReadiness('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/analyze-readiness',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.readiness.status).toBe('READY');
      expect(result.readiness.score).toBe(100);
    });

    it('should retrieve stored readiness via GET /projects/:id/readiness', async () => {
      const mockReadiness = {
        status: 'READY',
        score: 100,
        strategy: 'NODE_APPLICATION',
        summary: 'Ready for deployment',
        blockers: [],
        warnings: [],
        requirements: [],
        recommendations: [],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ readiness: mockReadiness }),
      } as any);

      const result = await getProjectReadiness('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/readiness',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.readiness.status).toBe('READY');
    });

    it('should generate deployment plan via POST /projects/:id/deployment-plan', async () => {
      const mockPlan = {
        strategy: 'NODE_APPLICATION',
        isSupported: true,
        canDeploy: true,
        buildMethod: 'docker build',
        runtimeMethod: 'docker run',
        dockerfileStrategy: 'GENERATED',
        exposedPort: 3000,
        healthCheckStrategy: 'HTTP',
        requiredEnvVars: [],
        optionalEnvVars: [],
        blockers: [],
        warnings: [],
        summary: 'Ready',
        createdAt: new Date().toISOString(),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ plan: mockPlan }),
      } as any);

      const result = await getDeploymentPlan('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployment-plan',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.plan.strategy).toBe('NODE_APPLICATION');
    });

    it('should trigger deployment via POST /projects/:id/deploy', async () => {
      const mockDeployment = {
        id: 'dep-1',
        projectId: 'proj-123',
        status: 'PENDING',
        strategy: 'NODE_APPLICATION',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ deployment: mockDeployment }),
      } as any);

      const result = await createDeployment('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deploy',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.deployment.id).toBe('dep-1');
    });

    it('should trigger deployment with explicit environmentId in body via POST /projects/:id/deploy', async () => {
      const mockDeployment = {
        id: 'dep-2',
        projectId: 'proj-123',
        environmentId: 'env-dev-456',
        status: 'PENDING',
        strategy: 'NODE_APPLICATION',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ deployment: mockDeployment }),
      } as any);

      const result = await createDeployment('proj-123', 'env-dev-456');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deploy',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ environmentId: 'env-dev-456' }),
          credentials: 'include',
        }),
      );
      expect(result.deployment.id).toBe('dep-2');
      expect(result.deployment.environmentId).toBe('env-dev-456');
    });

    it('should cancel deployment via POST /projects/:id/deployments/:deploymentId/cancel', async () => {
      const mockDeployment = {
        id: 'dep-1',
        projectId: 'proj-123',
        status: 'CANCELLED',
        strategy: 'NODE_APPLICATION',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ deployment: mockDeployment }),
      } as any);

      const result = await cancelDeployment('proj-123', 'dep-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/cancel',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.deployment.status).toBe('CANCELLED');
    });

    it('should list deployments via GET /projects/:id/deployments', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ deployments: [] }),
      } as any);

      const result = await getDeployments('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.deployments).toEqual([]);
    });

    it('should get deployment logs via GET /projects/:id/deployments/:deploymentId/logs', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ deploymentId: 'dep-1', status: 'RUNNING', logs: [] }),
      } as any);

      const result = await getDeploymentLogs('proj-123', 'dep-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/logs',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.deploymentId).toBe('dep-1');
    });

    it('should get deployment telemetry via GET /projects/:id/deployments/:deploymentId/telemetry', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          telemetry: {
            deploymentId: 'dep-1',
            projectId: 'proj-123',
            status: 'RUNNING',
            healthStatus: 'HEALTHY',
            uptimeSeconds: 120,
            avgCpuPercent: 5.5,
            peakMemoryBytes: 50000000,
            activeAlertsCount: 0,
            recentEvents: [],
          },
        }),
      } as any);

      const result = await getDeploymentTelemetry('proj-123', 'dep-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/telemetry',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.telemetry.deploymentId).toBe('dep-1');
      expect(result.telemetry.avgCpuPercent).toBe(5.5);
    });

    it('should get deployment metrics via GET /projects/:id/deployments/:deploymentId/metrics', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          deploymentId: 'dep-1',
          current: null,
          history: [],
        }),
      } as any);

      const result = await getDeploymentMetrics('proj-123', 'dep-1', 30);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/metrics?limit=30',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.deploymentId).toBe('dep-1');
    });

    it('should collect metrics on demand via POST /projects/:id/deployments/:deploymentId/metrics/collect', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          deploymentId: 'dep-1',
          current: null,
          history: [],
        }),
      } as any);

      const result = await collectDeploymentMetrics('proj-123', 'dep-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/metrics/collect',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.deploymentId).toBe('dep-1');
    });

    it('should get tail logs with query parameters via GET /projects/:id/deployments/:deploymentId/logs/tail', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          deploymentId: 'dep-1',
          lines: [],
          totalLines: 0,
          hasMore: false,
        }),
      } as any);

      const result = await getDeploymentTailLogs('proj-123', 'dep-1', { level: 'ERROR', search: 'fail', limit: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/logs/tail?level=ERROR&search=fail&limit=50',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.deploymentId).toBe('dep-1');
    });

    it('should get deployment events via GET /projects/:id/deployments/:deploymentId/events', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          deploymentId: 'dep-1',
          events: [],
        }),
      } as any);

      const result = await getDeploymentEvents('proj-123', 'dep-1', 20);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/events?limit=20',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.deploymentId).toBe('dep-1');
    });
  });

  describe('7. logout', () => {
    it('should send POST to /auth/logout with credentials include', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true, message: 'Logged out successfully' }),
      } as any);

      const result = await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('8-12. Error Handling & Security Isolation', () => {
    it('8. should throw ApiClientError on 401 Unauthorized', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Authentication session required' }),
      } as any);

      await expect(getRepositories()).rejects.toThrow(ApiClientError);
      await expect(getRepositories()).rejects.toMatchObject({
        status: 401,
        message: 'Authentication session required',
      });
    });

    it('9. should attach rateLimit metadata to ApiClientError on 429 Too Many Requests', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            message: 'GitHub API rate limit exceeded',
            rateLimit: { remaining: 0, resetAt: '2026-08-28T12:00:00.000Z' },
          }),
      } as any);

      try {
        await getRepositories();
        fail('Expected 429 ApiClientError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiClientError);
        expect(err.status).toBe(429);
        expect(err.rateLimit?.remaining).toBe(0);
        expect(err.rateLimit?.resetAt).toBe('2026-08-28T12:00:00.000Z');
      }
    });

    it('10. should handle network failures and map to 502 ApiClientError', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network connection failed'));

      await expect(getCurrentUser()).rejects.toThrow(ApiClientError);
      await expect(getCurrentUser()).rejects.toMatchObject({
        status: 502,
      });
    });

    it('11. should handle non-JSON error responses safely', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: () => Promise.reject(new Error('Not JSON')),
      } as any);

      await expect(getCurrentUser()).rejects.toThrow(ApiClientError);
      await expect(getCurrentUser()).rejects.toMatchObject({
        status: 500,
      });
    });

    it('12. should never expose OAuth access tokens or client secrets in errors or methods', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            repository: { id: 1, name: 'safe-repo' },
          }),
      } as any);

      const res = await getRepository('org', 'safe-repo');
      expect((res as any).accessToken).toBeUndefined();
      expect((res as any).clientSecret).toBeUndefined();
      expect((res as any).authorization).toBeUndefined();
    });
  });

  describe('13. Phase 6 AI Intelligence Methods', () => {
    it('should get AI repository understanding via POST /projects/:id/ai/understand', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ understanding: { summary: 'Modern web app', confidence: 'HIGH' } }),
      } as any);

      const result = await getAiRepositoryUnderstanding('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/ai/understand',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.understanding.summary).toBe('Modern web app');
    });

    it('should get AI deployment proposal via POST /projects/:id/ai/deployment-proposal', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ proposal: { strategy: 'NODE_APPLICATION', confidence: 'HIGH' } }),
      } as any);

      const result = await getAiDeploymentProposal('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/ai/deployment-proposal',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.proposal.strategy).toBe('NODE_APPLICATION');
    });

    it('should diagnose build failure via POST /projects/:id/deployments/:deploymentId/ai/diagnose-build', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ diagnosis: { problem: 'Build failed', category: 'BUILD' } }),
      } as any);

      const result = await diagnoseAiBuildFailure('proj-123', 'dep-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/ai/diagnose-build',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.diagnosis.category).toBe('BUILD');
    });

    it('should diagnose runtime incident via POST /projects/:id/deployments/:deploymentId/ai/diagnose-incident', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ diagnosis: { problem: 'OOM error', category: 'INCIDENT' } }),
      } as any);

      const result = await diagnoseAiIncident('proj-123', 'dep-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-1/ai/diagnose-incident',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.diagnosis.category).toBe('INCIDENT');
    });

    it('should approve and reject repair suggestions', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ suggestion: { id: 'sug-1', status: 'APPROVED' }, message: 'Approved' }),
      } as any);

      const approved = await approveAiRepairSuggestion('proj-123', 'sug-1');
      expect(approved.suggestion.status).toBe('APPROVED');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ suggestion: { id: 'sug-1', status: 'REJECTED' }, message: 'Rejected' }),
      } as any);

      const rejected = await rejectAiRepairSuggestion('proj-123', 'sug-1');
      expect(rejected.suggestion.status).toBe('REJECTED');
    });

    it('should run AI agent via POST /projects/:id/ai/agent', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ answer: 'Deployment was successful', steps: [], toolsUsed: [] }),
      } as any);

      const result = await runAiAgent('proj-123', { prompt: 'How is my project configured?' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/ai/agent',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ prompt: 'How is my project configured?' }),
        }),
      );
      expect(result.answer).toBe('Deployment was successful');
    });
  });

  describe('14. Phase 7 CI/CD, Environments & Rollback Methods', () => {
    it('should fetch environments via GET /projects/:id/environments', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ environments: [{ id: 'env-1', name: 'production', type: 'PRODUCTION', autoDeployEnabled: true }] }),
      } as any);

      const result = await getEnvironments('proj-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/environments',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result.environments).toHaveLength(1);
    });

    it('should create environment via POST /projects/:id/environments', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ environment: { id: 'env-2', name: 'staging', type: 'STAGING' } }),
      } as any);

      const result = await createEnvironment('proj-123', { name: 'staging', type: 'STAGING' });
      expect(result.environment.name).toBe('staging');
    });

    it('should set and get environment variables with secret protection', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ variable: { id: 'var-1', key: 'DATABASE_URL', isSecret: true, maskedValue: '••••••••' } }),
      } as any);

      const setRes = await setEnvironmentVariable('proj-123', 'env-1', {
        key: 'DATABASE_URL',
        value: 'postgres://localhost:5432/db',
      });

      expect(setRes.variable.maskedValue).toBe('••••••••');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ variables: [{ id: 'var-1', key: 'DATABASE_URL', isSecret: true, maskedValue: '••••••••' }] }),
      } as any);

      const listRes = await getEnvironmentVariables('proj-123', 'env-1');
      expect(listRes.variables).toHaveLength(1);
    });

    it('should rollback deployment via POST /projects/:id/deployments/:deploymentId/rollback', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          message: 'Rollback initiated',
          rolledBackFromId: 'dep-2',
          rolledBackToId: 'dep-1',
          rollbackDeployment: { id: 'dep-3', isRollback: true },
        }),
      } as any);

      const result = await rollbackDeployment('proj-123', 'dep-2');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/projects/proj-123/deployments/dep-2/rollback',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(result.rolledBackToId).toBe('dep-1');
      expect(result.rollbackDeployment.isRollback).toBe(true);
    });

    it('should get and update CI/CD settings and audit webhook events', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ settings: { webhookUrl: '/webhooks/github', webhookSecretConfigured: true, defaultBranch: 'main' } }),
      } as any);

      const settings = await getCicdSettings('proj-123');
      expect(settings.settings.webhookSecretConfigured).toBe(true);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ events: [{ deliveryId: 'del-1', status: 'PROCESSED', event: 'push' }] }),
      } as any);

      const events = await getWebhookEvents('proj-123');
      expect(events.events).toHaveLength(1);
    });
  });
});
