import { DeploymentReadinessService } from './deployment-readiness.service';
import {
  RepositoryAnalysisDto,
  ApplicationStructureDto,
} from '@cloudpilot/shared';

describe('DeploymentReadinessService (Phase 3.4)', () => {
  let service: DeploymentReadinessService;

  beforeEach(() => {
    service = new DeploymentReadinessService();
  });

  const baseAnalysis: Partial<RepositoryAnalysisDto> = {
    projectType: 'WEB_APPLICATION',
    primaryLanguage: 'TypeScript',
    framework: 'Next.js',
    packageManager: 'pnpm',
    isMonorepo: false,
    hasDockerfile: false,
    hasDockerCompose: false,
    hasEnvExample: true,
    detectedFiles: ['package.json', 'next.config.ts'],
  };

  const baseStructure: ApplicationStructureDto = {
    primaryRole: 'FULLSTACK',
    confidence: 'HIGH',
    applications: [
      {
        name: 'next-app',
        path: '.',
        role: 'FULLSTACK',
        framework: 'Next.js',
        language: 'TypeScript',
        packageManager: 'pnpm',
        entryPoint: { path: 'app/page.tsx', isDefault: true, evidence: 'Next.js App router' },
        buildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
        startCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
        port: { port: 3000, source: '.env.example', confidence: 'HIGH' },
        outputDirectory: { path: '.next', isConfigured: false, source: 'Next.js' },
        confidence: 'HIGH',
        evidence: ['Next.js App router'],
      },
    ],
    relationships: [],
    topLevelEntryPoint: { path: 'app/page.tsx', isDefault: true, evidence: 'Next.js App router' },
    topLevelBuildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
    topLevelStartCommand: { command: 'npm start', isDeclared: true, source: 'package.json' },
    topLevelPort: { port: 3000, source: '.env.example', confidence: 'HIGH' },
    topLevelOutputDirectory: { path: '.next', isConfigured: false, source: 'Next.js' },
    evidence: ['Next.js framework'],
  };

  // -------------------------------------------------------------------------
  // 1. Stack Readiness & Strategy Resolution
  // -------------------------------------------------------------------------

  describe('Stack Readiness & Strategy Resolution', () => {
    it('1. should evaluate Next.js fullstack app as READY with NODE_APPLICATION strategy (score 100)', () => {
      const result = service.analyzeReadiness(
        baseAnalysis,
        baseStructure,
        null,
        'PORT=3000\nDATABASE_URL=postgres://localhost:5432/db',
      );

      expect(result.status).toBe('READY');
      expect(result.strategy).toBe('NODE_APPLICATION');
      expect(result.score).toBe(100);
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.requirements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'DATABASE_URL', required: true }),
          expect.objectContaining({ name: 'PORT', required: false }),
        ]),
      );
    });

    it('2. should evaluate React/Vite app as READY with STATIC_FRONTEND strategy', () => {
      const viteAnalysis: Partial<RepositoryAnalysisDto> = {
        projectType: 'WEB_APPLICATION',
        primaryLanguage: 'TypeScript',
        framework: 'Vite',
        packageManager: 'npm',
        hasEnvExample: true,
      };

      const viteStructure: ApplicationStructureDto = {
        primaryRole: 'FRONTEND',
        confidence: 'HIGH',
        applications: [],
        relationships: [],
        topLevelEntryPoint: { path: 'src/main.tsx', isDefault: true, evidence: 'Vite entry' },
        topLevelBuildCommand: { command: 'npm run build', isDeclared: true, source: 'package.json' },
        topLevelStartCommand: { command: 'vite preview', isDeclared: false, source: 'Vite convention' },
        topLevelPort: { port: 5173, source: 'Vite default', confidence: 'MEDIUM' },
        topLevelOutputDirectory: { path: 'dist', isConfigured: false, source: 'Vite convention' },
        evidence: ['Vite frontend'],
      };

      const result = service.analyzeReadiness(viteAnalysis, viteStructure, null, 'VITE_API_URL=http://api.internal');

      expect(result.status).toBe('READY_WITH_WARNINGS'); // due to inferred start command
      expect(result.strategy).toBe('STATIC_FRONTEND');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.blockers).toHaveLength(0);
    });

    it('3. should evaluate Python FastAPI app as PYTHON_APPLICATION strategy', () => {
      const pyAnalysis: Partial<RepositoryAnalysisDto> = {
        projectType: 'PYTHON_APPLICATION',
        primaryLanguage: 'Python',
        framework: 'FastAPI',
        packageManager: 'poetry',
        hasEnvExample: true,
      };

      const pyStructure: ApplicationStructureDto = {
        primaryRole: 'API',
        confidence: 'HIGH',
        applications: [],
        relationships: [],
        topLevelEntryPoint: { path: 'main.py', isDefault: true, evidence: 'FastAPI main' },
        topLevelBuildCommand: null,
        topLevelStartCommand: { command: 'uvicorn main:app --host 0.0.0.0 --port 8000', isDeclared: false, source: 'FastAPI convention' },
        topLevelPort: { port: 8000, source: '.env.example', confidence: 'HIGH' },
        topLevelOutputDirectory: null,
        evidence: ['FastAPI backend'],
      };

      const result = service.analyzeReadiness(pyAnalysis, pyStructure, null, 'PORT=8000');

      expect(result.strategy).toBe('PYTHON_APPLICATION');
      expect(result.blockers).toHaveLength(0);
    });

    it('4. should evaluate Java Spring Boot app as JAVA_APPLICATION strategy', () => {
      const javaAnalysis: Partial<RepositoryAnalysisDto> = {
        projectType: 'JAVA_APPLICATION',
        primaryLanguage: 'Java',
        framework: 'Spring Boot',
        packageManager: 'maven',
        hasEnvExample: false,
      };

      const javaStructure: ApplicationStructureDto = {
        primaryRole: 'BACKEND',
        confidence: 'HIGH',
        applications: [],
        relationships: [],
        topLevelEntryPoint: { path: 'src/main/java/com/example/Application.java', isDefault: true, evidence: 'Spring Boot' },
        topLevelBuildCommand: { command: 'mvn package', isDeclared: false, source: 'Maven pom.xml' },
        topLevelStartCommand: { command: 'java -jar target/app.jar', isDeclared: false, source: 'Spring Boot' },
        topLevelPort: { port: 8080, source: 'Spring Boot default', confidence: 'MEDIUM' },
        topLevelOutputDirectory: { path: 'target', isConfigured: false, source: 'Maven' },
        evidence: ['Spring Boot backend'],
      };

      const result = service.analyzeReadiness(javaAnalysis, javaStructure);

      expect(result.strategy).toBe('JAVA_APPLICATION');
      expect(result.blockers).toHaveLength(0);
    });

    it('5. should evaluate Go app as GO_APPLICATION strategy', () => {
      const goAnalysis: Partial<RepositoryAnalysisDto> = {
        projectType: 'GO_APPLICATION',
        primaryLanguage: 'Go',
        framework: 'Go',
        packageManager: 'go',
      };

      const goStructure: ApplicationStructureDto = {
        primaryRole: 'BACKEND',
        confidence: 'HIGH',
        applications: [],
        relationships: [],
        topLevelEntryPoint: { path: 'main.go', isDefault: true, evidence: 'Go main' },
        topLevelBuildCommand: { command: 'go build', isDeclared: false, source: 'Go convention' },
        topLevelStartCommand: { command: 'go run .', isDeclared: false, source: 'Go convention' },
        topLevelPort: { port: 8080, source: '.env.example', confidence: 'HIGH' },
        topLevelOutputDirectory: null,
        evidence: ['Go server'],
      };

      const result = service.analyzeReadiness(goAnalysis, goStructure, null, 'PORT=8080');

      expect(result.strategy).toBe('GO_APPLICATION');
      expect(result.blockers).toHaveLength(0);
    });

    it('6. should evaluate Dockerfile as DOCKER_APPLICATION strategy', () => {
      const dockerAnalysis: Partial<RepositoryAnalysisDto> = {
        projectType: 'DOCKER_APPLICATION',
        hasDockerfile: true,
      };

      const dockerStructure: ApplicationStructureDto = {
        primaryRole: 'SERVICE',
        confidence: 'MEDIUM',
        applications: [],
        relationships: [],
        topLevelEntryPoint: null,
        topLevelBuildCommand: null,
        topLevelStartCommand: { command: 'docker run', isDeclared: false, source: 'Dockerfile' },
        topLevelPort: { port: 8080, source: 'Dockerfile EXPOSE', confidence: 'HIGH' },
        topLevelOutputDirectory: null,
        evidence: ['Dockerfile'],
      };

      const dockerfile = 'FROM alpine:3.19\nEXPOSE 8080\nCMD ["./service"]';
      const result = service.analyzeReadiness(dockerAnalysis, dockerStructure, dockerfile);

      expect(result.strategy).toBe('DOCKER_APPLICATION');
      expect(result.blockers).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Monorepo Multi-Application Readiness
  // -------------------------------------------------------------------------

  describe('Monorepo Multi-Application Readiness', () => {
    it('7. should evaluate monorepo as MULTI_APPLICATION with per-sub-app breakdown', () => {
      const monorepoAnalysis: Partial<RepositoryAnalysisDto> = {
        isMonorepo: true,
        hasEnvExample: true,
      };

      const monorepoStructure: ApplicationStructureDto = {
        primaryRole: 'FULLSTACK',
        confidence: 'HIGH',
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
        relationships: [
          { source: 'web', target: 'api', relationshipType: 'CLIENT_SERVER', evidence: ['co-located'] },
        ],
        topLevelEntryPoint: null,
        topLevelBuildCommand: { command: 'npm run build', isDeclared: true, source: 'root package.json' },
        topLevelStartCommand: { command: 'npm start', isDeclared: true, source: 'root package.json' },
        topLevelPort: { port: 3000, source: '.env.example', confidence: 'HIGH' },
        topLevelOutputDirectory: null,
        evidence: ['Monorepo'],
      };

      const result = service.analyzeReadiness(monorepoAnalysis, monorepoStructure);

      expect(result.strategy).toBe('MULTI_APPLICATION');
      expect(result.subApplicationsReadiness).toBeDefined();
      expect(result.subApplicationsReadiness).toHaveLength(2); // web & api, shared excluded
      expect(result.subApplicationsReadiness![0].name).toBe('api');
      expect(result.subApplicationsReadiness![1].name).toBe('web');
      expect(result.blockers).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Blockers & Warnings
  // -------------------------------------------------------------------------

  describe('Blockers & Warnings Evaluation', () => {
    it('8. should block when start command and entrypoint are missing', () => {
      const missingStartStructure: ApplicationStructureDto = {
        ...baseStructure,
        topLevelStartCommand: null,
        topLevelEntryPoint: null,
      };

      const result = service.analyzeReadiness(baseAnalysis, missingStartStructure);

      expect(result.status).toBe('BLOCKED');
      expect(result.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_START_COMMAND' }),
        ]),
      );
    });

    it('9. should block when build command is missing for frontend app', () => {
      const missingBuildStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'FRONTEND',
        topLevelBuildCommand: null,
      };

      const result = service.analyzeReadiness(baseAnalysis, missingBuildStructure);

      expect(result.status).toBe('BLOCKED');
      expect(result.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_BUILD_COMMAND' }),
        ]),
      );
    });

    it('10. should block standalone deployment for LIBRARY or CLI roles', () => {
      const libStructure: ApplicationStructureDto = {
        ...baseStructure,
        primaryRole: 'LIBRARY',
      };

      const result = service.analyzeReadiness(baseAnalysis, libStructure);

      expect(result.status).toBe('BLOCKED');
      expect(result.strategy).toBe('UNSUPPORTED');
      expect(result.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'NON_DEPLOYABLE_ROLE' }),
        ]),
      );
    });

    it('11. should warn when .env.example is missing', () => {
      const noEnvAnalysis: Partial<RepositoryAnalysisDto> = {
        ...baseAnalysis,
        hasEnvExample: false,
      };

      const result = service.analyzeReadiness(noEnvAnalysis, baseStructure);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_ENV_EXAMPLE' }),
        ]),
      );
      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'CREATE_ENV_EXAMPLE' }),
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. Determinism & Security
  // -------------------------------------------------------------------------

  describe('Determinism & Security', () => {
    it('12. should produce identical output when run multiple times on identical input (Determinism)', () => {
      const run1 = service.analyzeReadiness(baseAnalysis, baseStructure, null, 'PORT=3000');
      const run2 = service.analyzeReadiness(baseAnalysis, baseStructure, null, 'PORT=3000');

      expect(run1).toEqual(run2);
      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    });

    it('13. should never expose secrets or credentials in readiness result', () => {
      const result = service.analyzeReadiness(
        baseAnalysis,
        baseStructure,
        null,
        'SECRET_KEY=super_secret_key_12345\nPASSWORD=db_password',
      );
      const str = JSON.stringify(result);

      expect(str).not.toContain('super_secret_key_12345');
      expect(str).not.toContain('db_password');
    });

    it('14. should not classify PORT, HOST, HOSTNAME, NODE_ENV as required blockers while keeping app secrets required', () => {
      const result = service.analyzeReadiness(
        baseAnalysis,
        baseStructure,
        null,
        'PORT=5000\nHOST=0.0.0.0\nNODE_ENV=production\nOPENAI_API_KEY=sk-test\nJWT_SECRET=supersecret',
      );

      const portReq = result.requirements.find((r) => r.name === 'PORT');
      const hostReq = result.requirements.find((r) => r.name === 'HOST');
      const nodeEnvReq = result.requirements.find((r) => r.name === 'NODE_ENV');
      const openaiReq = result.requirements.find((r) => r.name === 'OPENAI_API_KEY');
      const jwtReq = result.requirements.find((r) => r.name === 'JWT_SECRET');

      expect(portReq).toBeDefined();
      expect(portReq?.required).toBe(false);
      expect(portReq?.documented).toBe(true);
      expect(portReq?.source).toBe('.env.example');

      expect(hostReq).toBeDefined();
      expect(hostReq?.required).toBe(false);

      expect(nodeEnvReq).toBeDefined();
      expect(nodeEnvReq?.required).toBe(false);

      expect(openaiReq).toBeDefined();
      expect(openaiReq?.required).toBe(true);

      expect(jwtReq).toBeDefined();
      expect(jwtReq?.required).toBe(true);
    });
  });
});
