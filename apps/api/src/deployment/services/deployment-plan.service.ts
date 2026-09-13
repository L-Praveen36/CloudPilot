import { Injectable, Logger } from '@nestjs/common';
import {
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
  DeploymentPlan,
  DeploymentStrategy,
  DeploymentBlocker,
  DeploymentWarning,
  SubApplicationPlan,
} from '@cloudpilot/shared';

@Injectable()
export class DeploymentPlanService {
  private readonly logger = new Logger(DeploymentPlanService.name);

  /**
   * Generates a deterministic deployment plan from Phase 3 analysis, structure, and readiness.
   */
  generatePlan(
    analysis: RepositoryAnalysisDto,
    structure: ApplicationStructureDto,
    readiness: DeploymentReadinessDto,
    existingDockerfileContent?: string | null,
  ): DeploymentPlan {
    const blockers: DeploymentBlocker[] = [...(readiness.blockers || [])];
    const warnings: DeploymentWarning[] = [...(readiness.warnings || [])];
    const strategy: DeploymentStrategy = readiness.strategy || 'UNKNOWN';

    const reqSet = new Set<string>();
    const optSet = new Set<string>();

    if (readiness.requirements) {
      for (const req of readiness.requirements) {
        if (req.required) {
          reqSet.add(req.name);
          optSet.delete(req.name);
        } else if (!reqSet.has(req.name)) {
          optSet.add(req.name);
        }
      }
    }
    const requiredEnvVars = Array.from(reqSet).sort();
    const optionalEnvVars = Array.from(optSet).sort();

    // 1. Check for Readiness Blockers or Unsupported Strategies
    if (readiness.status === 'BLOCKED' || strategy === 'UNSUPPORTED' || strategy === 'UNKNOWN') {
      return {
        strategy,
        isSupported: false,
        canDeploy: false,
        buildMethod: 'NONE',
        runtimeMethod: 'NONE',
        dockerfileStrategy: 'NONE',
        exposedPort: null,
        healthCheckStrategy: 'NONE',
        requiredEnvVars,
        optionalEnvVars,
        blockers: blockers.sort((a, b) => a.code.localeCompare(b.code)),
        warnings: warnings.sort((a, b) => a.code.localeCompare(b.code)),
        summary: `Deployment is blocked: ${readiness.summary || 'Project is not currently deployable.'}`,
        createdAt: new Date().toISOString(),
      };
    }

    // 2. Validate Existing Dockerfile if present
    if (analysis.hasDockerfile || existingDockerfileContent) {
      const dockerfileValidation = this.validateDockerfile(existingDockerfileContent || '');
      if (!dockerfileValidation.isValid) {
        blockers.push(...dockerfileValidation.blockers);
        warnings.push(...dockerfileValidation.warnings);
        return {
          strategy: 'DOCKER_APPLICATION',
          isSupported: true,
          canDeploy: false,
          buildMethod: 'docker build',
          runtimeMethod: 'docker run',
          dockerfileStrategy: 'EXISTING',
          exposedPort: structure.topLevelPort?.port || 8080,
          healthCheckStrategy: 'HTTP',
          healthCheckPath: '/',
          requiredEnvVars,
          optionalEnvVars,
          blockers: blockers.sort((a, b) => a.code.localeCompare(b.code)),
          warnings: warnings.sort((a, b) => a.code.localeCompare(b.code)),
          summary: 'Dockerfile validation failed due to security policy violations.',
          createdAt: new Date().toISOString(),
        };
      }

      const exposedPort = structure.topLevelPort?.port || this.extractExposedPortFromDockerfile(existingDockerfileContent) || 8080;
      const isWorker = structure.primaryRole === 'WORKER';

      return {
        strategy: 'DOCKER_APPLICATION',
        isSupported: true,
        canDeploy: blockers.length === 0,
        buildMethod: 'docker build -t <tag> .',
        runtimeMethod: 'docker run -d <image>',
        dockerfileStrategy: 'EXISTING',
        exposedPort: isWorker ? null : exposedPort,
        healthCheckStrategy: isWorker ? 'PROCESS' : 'HTTP',
        healthCheckPath: isWorker ? undefined : '/',
        requiredEnvVars,
        optionalEnvVars,
        blockers: blockers.sort((a, b) => a.code.localeCompare(b.code)),
        warnings: warnings.sort((a, b) => a.code.localeCompare(b.code)),
        summary: 'Deployment planned using repository Dockerfile.',
        createdAt: new Date().toISOString(),
      };
    }

    // 3. Multi-Application Strategy
    if (strategy === 'MULTI_APPLICATION') {
      const subApplicationsPlans: SubApplicationPlan[] = [];
      const deployableApps = (structure.applications || []).filter((app) => app.role !== 'LIBRARY');

      for (const app of deployableApps) {
        const subPlan = this.generateSubApplicationPlan(app);
        subApplicationsPlans.push(subPlan);
      }
      subApplicationsPlans.sort((a, b) => a.path.localeCompare(b.path));

      // Resolve primary app and exposed port: prioritize backend/API server if present
      const backendSubApp = deployableApps.find(
        (a) =>
          a.role === 'API' ||
          a.role === 'BACKEND' ||
          a.role === 'FULLSTACK' ||
          a.role === 'SERVICE' ||
          (a.role !== 'FRONTEND' && a.role !== 'WORKER'),
      );
      const frontendSubApp = deployableApps.find((a) => a.role === 'FRONTEND');

      let exposedPort: number = 3000;
      const healthCheckStrategy: 'HTTP' | 'PROCESS' | 'STATIC' | 'NONE' = 'HTTP';

      if (backendSubApp) {
        exposedPort =
          backendSubApp.port?.port ||
          (backendSubApp.framework === 'Express' ? 5000 : (backendSubApp.language === 'Python' ? 8000 : 3000));
      } else if (frontendSubApp) {
        exposedPort = 80;
      } else {
        const primaryApp = subApplicationsPlans.find((p) => p.isSupported) || subApplicationsPlans[0];
        exposedPort = primaryApp?.exposedPort || 3000;
      }

      const generatedDockerfile = this.generateDockerfileForStrategy(strategy, analysis, structure);

      // Validate that generated Dockerfile is executable and not a fallback stub
      const isFallbackStub =
        !generatedDockerfile || generatedDockerfile.includes('CMD ["echo", "Application started"]');
      if (isFallbackStub) {
        blockers.push({
          code: 'UNSUPPORTED_DEPLOYMENT_STRATEGY',
          category: 'DEPLOYMENT_STRATEGY',
          message:
            'No executable container configuration could be generated for this multi-application structure.',
        });
      }

      return {
        strategy: 'MULTI_APPLICATION',
        isSupported: !isFallbackStub,
        canDeploy: blockers.length === 0 && !isFallbackStub,
        buildMethod: 'docker build (multi-application)',
        runtimeMethod: 'docker run',
        dockerfileStrategy: 'GENERATED',
        generatedDockerfile,
        exposedPort,
        healthCheckStrategy,
        healthCheckPath: '/',
        requiredEnvVars,
        optionalEnvVars,
        subApplicationsPlans,
        blockers: blockers.sort((a, b) => a.code.localeCompare(b.code)),
        warnings: warnings.sort((a, b) => a.code.localeCompare(b.code)),
        summary: isFallbackStub
          ? 'Deployment blocked: Unsupported multi-application structure.'
          : `Deployment planned for multi-application repository with ${subApplicationsPlans.length} deployable applications.`,
        createdAt: new Date().toISOString(),
      };
    }

    // 4. Single Application Generated Plans (STATIC_FRONTEND, NODE, PYTHON, JAVA, GO)
    const isWorker = structure.primaryRole === 'WORKER';
    let exposedPort: number | null = structure.topLevelPort?.port || null;
    let healthCheckStrategy: 'HTTP' | 'PROCESS' | 'STATIC' | 'NONE' = 'HTTP';

    if (strategy === 'STATIC_FRONTEND') {
      exposedPort = 80;
      healthCheckStrategy = 'HTTP';
    } else if (isWorker) {
      exposedPort = null;
      healthCheckStrategy = 'PROCESS';
    } else if (!exposedPort) {
      if (strategy === 'NODE_APPLICATION') exposedPort = 3000;
      else if (strategy === 'PYTHON_APPLICATION') exposedPort = 8000;
      else if (strategy === 'JAVA_APPLICATION') exposedPort = 8080;
      else if (strategy === 'GO_APPLICATION') exposedPort = 8080;
    }

    const generatedDockerfile = this.generateDockerfileForStrategy(strategy, analysis, structure);

    return {
      strategy,
      isSupported: true,
      canDeploy: blockers.length === 0,
      buildMethod: this.getBuildMethodDescription(strategy, structure),
      runtimeMethod: this.getRuntimeMethodDescription(strategy, structure),
      dockerfileStrategy: 'GENERATED',
      generatedDockerfile,
      exposedPort,
      healthCheckStrategy,
      healthCheckPath: isWorker ? undefined : '/',
      requiredEnvVars,
      optionalEnvVars,
      blockers: blockers.sort((a, b) => a.code.localeCompare(b.code)),
      warnings: warnings.sort((a, b) => a.code.localeCompare(b.code)),
      summary: `Deployment plan generated for ${strategy} with ${warnings.length} warning(s).`,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Statically validates a Dockerfile against security policies.
   */
  public validateDockerfile(content: string): {
    isValid: boolean;
    blockers: DeploymentBlocker[];
    warnings: DeploymentWarning[];
  } {
    const blockers: DeploymentBlocker[] = [];
    const warnings: DeploymentWarning[] = [];

    if (!content || !content.trim()) {
      blockers.push({
        code: 'EMPTY_DOCKERFILE',
        category: 'SECURITY',
        message: 'The Dockerfile is empty.',
      });
      return { isValid: false, blockers, warnings };
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      // Forbidden: Mounting docker socket or host filesystem
      if (line.toUpperCase().startsWith('VOLUME')) {
        if (line.includes('/var/run/docker.sock') || line.includes('docker.sock')) {
          blockers.push({
            code: 'FORBIDDEN_DOCKER_SOCKET_VOLUME',
            category: 'SECURITY',
            message: `Line ${i + 1}: Mounting the Docker socket into the container is prohibited for security reasons.`,
            evidence: [line],
          });
        }
        if (line.includes('/etc') || line.includes('/var') || line.includes('/proc') || line.includes('/sys')) {
          blockers.push({
            code: 'FORBIDDEN_HOST_PATH_VOLUME',
            category: 'SECURITY',
            message: `Line ${i + 1}: Mounting sensitive host system paths is prohibited.`,
            evidence: [line],
          });
        }
      }

      // Prohibited: --privileged flags or capabilities
      if (line.includes('--privileged')) {
        blockers.push({
          code: 'PRIVILEGED_MODE_FORBIDDEN',
          category: 'SECURITY',
          message: `Line ${i + 1}: Privileged container execution is not permitted.`,
          evidence: [line],
        });
      }

      // Warning: Insecure remote ADD instructions
      if (line.toUpperCase().startsWith('ADD') && (line.includes('http://') || line.includes('https://') || line.includes('ftp://'))) {
        warnings.push({
          code: 'REMOTE_ADD_INSTRUCTION',
          category: 'SECURITY',
          message: `Line ${i + 1}: Using ADD with remote URLs can introduce supply chain risks. Prefer curl/wget inside RUN.`,
          evidence: [line],
        });
      }

      // Warning: Secrets in ARG instructions
      if (line.toUpperCase().startsWith('ARG')) {
        const lower = line.toLowerCase();
        if (lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('key')) {
          warnings.push({
            code: 'POTENTIAL_SECRET_BUILD_ARG',
            category: 'SECURITY',
            message: `Line ${i + 1}: Build ARG appears to reference secrets. Build arguments are visible in image metadata.`,
            evidence: [line],
          });
        }
      }
    }

    // Must contain FROM
    const hasFrom = lines.some((l) => l.trim().toUpperCase().startsWith('FROM'));
    if (!hasFrom) {
      blockers.push({
        code: 'MISSING_FROM_INSTRUCTION',
        category: 'DOCKERFILE',
        message: 'Dockerfile does not contain a valid FROM instruction.',
      });
    }

    return {
      isValid: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  /**
   * Generates a deterministic Dockerfile string for a given strategy.
   */
  public generateDockerfileForStrategy(
    strategy: DeploymentStrategy,
    analysis: RepositoryAnalysisDto,
    structure: ApplicationStructureDto,
  ): string {
    switch (strategy) {
      case 'STATIC_FRONTEND': {
        const outDir = structure.topLevelOutputDirectory?.path || 'dist';
        return [
          '# CloudPilot Generated Multi-Stage Dockerfile for Static Frontend',
          'FROM node:22-alpine AS builder',
          'WORKDIR /app',
          'COPY package*.json pnpm-lock.yaml* yarn.lock* ./',
          'RUN if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile || pnpm install; \\',
          '    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile || yarn install; \\',
          '    elif [ -f package-lock.json ]; then npm ci || npm install; \\',
          '    else npm install; fi',
          'COPY . .',
          'RUN npm run build',
          '',
          'FROM nginx:alpine',
          `COPY --from=builder /app/${outDir} /usr/share/nginx/html`,
          'EXPOSE 80',
          'CMD ["nginx", "-g", "daemon off;"]',
        ].join('\n');
      }

      case 'NODE_APPLICATION': {
        const port = structure.topLevelPort?.port || 3000;
        const startCmd = structure.topLevelStartCommand?.command || 'npm start';
        const hasBuild = Boolean(structure.topLevelBuildCommand);

        if (analysis.framework === 'Next.js') {
          return [
            '# CloudPilot Generated Multi-Stage Dockerfile for Next.js',
            'FROM node:22-alpine AS builder',
            'WORKDIR /app',
            'COPY package*.json pnpm-lock.yaml* yarn.lock* ./',
            'RUN if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install; \\',
            '    elif [ -f yarn.lock ]; then yarn install; \\',
            '    elif [ -f package-lock.json ]; then npm ci || npm install; \\',
            '    else npm install; fi',
            'COPY . .',
            'ENV NEXT_TELEMETRY_DISABLED=1',
            'ENV NODE_ENV=production',
            'RUN npm run build',
            '',
            'FROM node:22-alpine AS runner',
            'WORKDIR /app',
            'ENV NODE_ENV=production',
            'ENV PORT=' + port,
            'COPY --from=builder /app ./',
            `EXPOSE ${port}`,
            'CMD ["npm", "start"]',
          ].join('\n');
        }

        return [
          '# CloudPilot Generated Dockerfile for Node.js Application',
          'FROM node:22-alpine',
          'WORKDIR /app',
          'ENV NODE_ENV=production',
          'ENV PORT=' + port,
          'COPY package*.json pnpm-lock.yaml* yarn.lock* ./',
          'RUN if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install; \\',
          '    elif [ -f yarn.lock ]; then yarn install; \\',
          '    elif [ -f package-lock.json ]; then npm ci || npm install; \\',
          '    else npm install; fi',
          'COPY . .',
          hasBuild ? 'RUN npm run build' : '# No build step required',
          `EXPOSE ${port}`,
          `CMD ["${startCmd.split(' ')[0]}", ${startCmd.split(' ').slice(1).map((a) => `"${a}"`).join(', ')}]`,
        ].filter(Boolean).join('\n');
      }

      case 'PYTHON_APPLICATION': {
        const port = structure.topLevelPort?.port || 8000;
        const startCmd = structure.topLevelStartCommand?.command || `uvicorn main:app --host 0.0.0.0 --port ${port}`;
        const cmdParts = startCmd.split(' ');

        return [
          '# CloudPilot Generated Dockerfile for Python Application',
          'FROM python:3.12-slim',
          'WORKDIR /app',
          'ENV PYTHONUNBUFFERED=1',
          'ENV PORT=' + port,
          'COPY requirements*.txt pyproject.toml* setup.py* ./',
          'RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; \\',
          '    elif [ -f pyproject.toml ]; then pip install --no-cache-dir poetry && poetry config virtualenvs.create false && poetry install --no-dev; \\',
          '    elif [ -f setup.py ]; then pip install --no-cache-dir .; fi',
          'COPY . .',
          `EXPOSE ${port}`,
          `CMD [${cmdParts.map((p) => `"${p}"`).join(', ')}]`,
        ].join('\n');
      }

      case 'JAVA_APPLICATION': {
        const port = structure.topLevelPort?.port || 8080;
        return [
          '# CloudPilot Generated Multi-Stage Dockerfile for Spring Boot / Java',
          'FROM maven:3.9-eclipse-temurin-21-alpine AS builder',
          'WORKDIR /app',
          'COPY pom.xml ./',
          'RUN mvn dependency:go-offline -B || true',
          'COPY src ./src',
          'RUN mvn package -DskipTests',
          '',
          'FROM eclipse-temurin:21-jre-alpine',
          'WORKDIR /app',
          'ENV PORT=' + port,
          'COPY --from=builder /app/target/*.jar app.jar',
          `EXPOSE ${port}`,
          'CMD ["java", "-jar", "app.jar"]',
        ].join('\n');
      }

      case 'GO_APPLICATION': {
        const port = structure.topLevelPort?.port || 8080;
        return [
          '# CloudPilot Generated Multi-Stage Dockerfile for Go Application',
          'FROM golang:1.23-alpine AS builder',
          'WORKDIR /app',
          'COPY go.mod go.sum* ./',
          'RUN go mod download || true',
          'COPY . .',
          'RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .',
          '',
          'FROM alpine:3.20',
          'WORKDIR /app',
          'ENV PORT=' + port,
          'COPY --from=builder /app/server /app/server',
          `EXPOSE ${port}`,
          'CMD ["/app/server"]',
        ].join('\n');
      }

      case 'MULTI_APPLICATION': {
        return this.generateMultiApplicationDockerfile(analysis, structure);
      }

      default:
        return [
          '# CloudPilot Generic Dockerfile',
          'FROM alpine:3.20',
          'WORKDIR /app',
          'COPY . .',
          'CMD ["echo", "Application started"]',
        ].join('\n');
    }
  }

  /**
   * Generates a multi-stage Dockerfile for multi-application repositories
   * (e.g. Frontend client + Backend API).
   */
  public generateMultiApplicationDockerfile(
    analysis: RepositoryAnalysisDto,
    structure: ApplicationStructureDto,
  ): string {
    const deployableApps = (structure.applications || []).filter((app) => app.role !== 'LIBRARY');
    if (deployableApps.length === 0) {
      return '';
    }

    const frontendApps = deployableApps.filter(
      (a) =>
        a.role === 'FRONTEND' ||
        a.framework === 'React' ||
        a.framework === 'Vite' ||
        a.framework === 'Vue' ||
        a.framework === 'Angular' ||
        a.framework === 'Svelte' ||
        a.outputDirectory !== null,
    );

    const backendApps = deployableApps.filter(
      (a) =>
        a.role === 'API' ||
        a.role === 'BACKEND' ||
        a.role === 'FULLSTACK' ||
        a.role === 'SERVICE' ||
        (!frontendApps.includes(a) && a.role !== 'WORKER'),
    );

    // Pattern 1: Fullstack Multi-App (Frontend Sub-App + Backend API)
    if (frontendApps.length > 0 && backendApps.length > 0) {
      const frontend = frontendApps[0];
      const backend = backendApps[0];

      const fPath = frontend.path === '.' ? 'client' : frontend.path;
      const bPath = backend.path === '.' ? 'server' : backend.path;

      const fBuildCmd = frontend.buildCommand?.command || 'npm run build';
      const fOutDir =
        frontend.outputDirectory?.path ||
        (frontend.buildCommand?.command?.includes('react-scripts')
          ? 'build'
          : frontend.framework === 'React'
            ? 'build'
            : 'dist');

      const bPort =
        backend.port?.port ||
        (backend.framework === 'Express'
          ? 5000
          : backend.language === 'Python'
            ? 8000
            : 3000);
      const bStartCmd =
        backend.startCommand?.command || structure.topLevelStartCommand?.command || 'npm start';
      const bCmdParts = bStartCmd.split(' ');

      const isPythonBackend = backend.language === 'Python';

      if (isPythonBackend) {
        return [
          '# CloudPilot Generated Multi-Stage Dockerfile for Fullstack Project (Frontend + Python API)',
          '# Stage 1: Build Frontend Sub-Application',
          'FROM node:22-alpine AS frontend-builder',
          `WORKDIR /app/${fPath}`,
          `COPY ${fPath}/package*.json ${fPath}/pnpm-lock.yaml* ${fPath}/yarn.lock* ./`,
          'RUN if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install; \\',
          '    elif [ -f yarn.lock ]; then yarn install; \\',
          '    elif [ -f package-lock.json ]; then npm ci || npm install; \\',
          '    else npm install; fi',
          `COPY ${fPath} ./`,
          `RUN ${fBuildCmd}`,
          '',
          '# Stage 2: Build & Run Python Backend Application',
          'FROM python:3.12-slim AS runner',
          'WORKDIR /app',
          'ENV PYTHONUNBUFFERED=1',
          `ENV PORT=${bPort}`,
          `COPY ${bPath}/requirements*.txt ${bPath}/pyproject.toml* ${bPath}/setup.py* ./${bPath}/`,
          `RUN if [ -f ${bPath}/requirements.txt ]; then pip install --no-cache-dir -r ${bPath}/requirements.txt; \\`,
          `    elif [ -f ${bPath}/pyproject.toml ]; then pip install --no-cache-dir poetry && cd ${bPath} && poetry config virtualenvs.create false && poetry install --no-dev; \\`,
          `    elif [ -f ${bPath}/setup.py ]; then pip install --no-cache-dir ./${bPath}; fi`,
          'COPY . .',
          `COPY --from=frontend-builder /app/${fPath}/${fOutDir} ./${fPath}/${fOutDir}`,
          `WORKDIR /app/${bPath}`,
          `EXPOSE ${bPort}`,
          `CMD [${bCmdParts.map((p) => `"${p}"`).join(', ')}]`,
        ].join('\n');
      }

      // Default Fullstack: Node.js Backend (Express, NestJS, etc.)
      const bBuildStep = backend.buildCommand?.command
        ? `RUN cd ${bPath} && ${backend.buildCommand.command}`
        : '# No backend build step required';

      return [
        '# CloudPilot Generated Multi-Stage Dockerfile for Fullstack Project',
        '# Stage 1: Build Frontend Sub-Application',
        'FROM node:22-alpine AS frontend-builder',
        `WORKDIR /app/${fPath}`,
        `COPY ${fPath}/package*.json ${fPath}/pnpm-lock.yaml* ${fPath}/yarn.lock* ./`,
        'RUN if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install; \\',
        '    elif [ -f yarn.lock ]; then yarn install; \\',
        '    elif [ -f package-lock.json ]; then npm ci || npm install; \\',
        '    else npm install; fi',
        `COPY ${fPath} ./`,
        `RUN ${fBuildCmd}`,
        '',
        '# Stage 2: Build & Run Backend Application',
        'FROM node:22-alpine AS runner',
        'WORKDIR /app',
        'ENV NODE_ENV=production',
        `ENV PORT=${bPort}`,
        `COPY ${bPath}/package*.json ${bPath}/pnpm-lock.yaml* ${bPath}/yarn.lock* ./${bPath}/`,
        `RUN cd ${bPath} && \\`,
        '    if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install; \\',
        '    elif [ -f yarn.lock ]; then yarn install; \\',
        '    elif [ -f package-lock.json ]; then npm ci || npm install; \\',
        '    else npm install; fi',
        'COPY . .',
        bBuildStep,
        `COPY --from=frontend-builder /app/${fPath}/${fOutDir} ./${fPath}/${fOutDir}`,
        `WORKDIR /app/${bPath}`,
        `EXPOSE ${bPort}`,
        `CMD ["${bCmdParts[0]}", ${bCmdParts.slice(1).map((a) => `"${a}"`).join(', ')}]`,
      ].filter(Boolean).join('\n');
    }

    // Pattern 2: Pure Frontend Multi-Application (Serve via Nginx)
    if (frontendApps.length > 0 && backendApps.length === 0) {
      const frontend = frontendApps[0];
      const fPath = frontend.path === '.' ? 'client' : frontend.path;
      const fBuildCmd = frontend.buildCommand?.command || 'npm run build';
      const fOutDir = frontend.outputDirectory?.path || 'dist';

      return [
        '# CloudPilot Generated Multi-Stage Dockerfile for Multi-Frontend Project',
        'FROM node:22-alpine AS builder',
        `WORKDIR /app/${fPath}`,
        `COPY ${fPath}/package*.json ${fPath}/pnpm-lock.yaml* ${fPath}/yarn.lock* ./`,
        'RUN if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile || pnpm install; \\',
        '    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile || yarn install; \\',
        '    elif [ -f package-lock.json ]; then npm ci || npm install; \\',
        '    else npm install; fi',
        `COPY ${fPath} ./`,
        `RUN ${fBuildCmd}`,
        '',
        'FROM nginx:alpine',
        `COPY --from=builder /app/${fPath}/${fOutDir} /usr/share/nginx/html`,
        'EXPOSE 80',
        'CMD ["nginx", "-g", "daemon off;"]',
      ].join('\n');
    }

    // Pattern 3: Backend-Only Multi-App (Run primary backend service)
    if (backendApps.length > 0) {
      const backend = backendApps[0];
      const bPath = backend.path === '.' ? '.' : backend.path;
      const bPort =
        backend.port?.port ||
        (backend.framework === 'Express'
          ? 5000
          : backend.language === 'Python'
            ? 8000
            : 3000);
      const bStartCmd =
        backend.startCommand?.command || structure.topLevelStartCommand?.command || 'npm start';
      const bCmdParts = bStartCmd.split(' ');
      const bBuildStep = backend.buildCommand?.command
        ? `RUN cd ${bPath} && ${backend.buildCommand.command}`
        : '# No backend build step required';

      return [
        '# CloudPilot Generated Dockerfile for Multi-Backend Application',
        'FROM node:22-alpine',
        'WORKDIR /app',
        'ENV NODE_ENV=production',
        `ENV PORT=${bPort}`,
        bPath === '.'
          ? 'COPY package*.json pnpm-lock.yaml* yarn.lock* ./'
          : `COPY ${bPath}/package*.json ${bPath}/pnpm-lock.yaml* ${bPath}/yarn.lock* ./${bPath}/`,
        bPath === '.'
          ? 'RUN if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install; \\\n    elif [ -f yarn.lock ]; then yarn install; \\\n    elif [ -f package-lock.json ]; then npm ci || npm install; \\\n    else npm install; fi'
          : `RUN cd ${bPath} && \\\n    if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install; \\\n    elif [ -f yarn.lock ]; then yarn install; \\\n    elif [ -f package-lock.json ]; then npm ci || npm install; \\\n    else npm install; fi`,
        'COPY . .',
        bBuildStep,
        bPath === '.' ? 'WORKDIR /app' : `WORKDIR /app/${bPath}`,
        `EXPOSE ${bPort}`,
        `CMD ["${bCmdParts[0]}", ${bCmdParts.slice(1).map((a) => `"${a}"`).join(', ')}]`,
      ].filter(Boolean).join('\n');
    }

    return [
      '# CloudPilot Generic Dockerfile',
      'FROM alpine:3.20',
      'WORKDIR /app',
      'COPY . .',
      'CMD ["echo", "Application started"]',
    ].join('\n');
  }

  private generateSubApplicationPlan(app: any): SubApplicationPlan {
    let subStrategy: DeploymentStrategy = 'NODE_APPLICATION';
    let exposedPort: number | null = app.port?.port || null;
    let healthCheckStrategy: 'HTTP' | 'PROCESS' | 'STATIC' | 'NONE' = 'HTTP';

    if (app.role === 'FRONTEND') {
      subStrategy = 'STATIC_FRONTEND';
      exposedPort = 80;
    } else if (app.role === 'WORKER') {
      exposedPort = null;
      healthCheckStrategy = 'PROCESS';
    } else if (app.language === 'Python') {
      subStrategy = 'PYTHON_APPLICATION';
      if (!exposedPort) exposedPort = 8000;
    } else if (app.language === 'Java') {
      subStrategy = 'JAVA_APPLICATION';
      if (!exposedPort) exposedPort = 8080;
    } else if (app.language === 'Go') {
      subStrategy = 'GO_APPLICATION';
      if (!exposedPort) exposedPort = 8080;
    } else {
      if (!exposedPort) exposedPort = 3000;
    }

    return {
      name: app.name,
      path: app.path,
      strategy: subStrategy,
      isSupported: true,
      buildMethod: app.buildCommand?.command || 'npm run build',
      runtimeMethod: app.startCommand?.command || 'npm start',
      dockerfileStrategy: 'GENERATED',
      exposedPort,
      healthCheckStrategy,
      healthCheckPath: healthCheckStrategy === 'HTTP' ? '/' : undefined,
    };
  }

  private extractExposedPortFromDockerfile(content?: string | null): number | null {
    if (!content) return null;
    const match = content.match(/EXPOSE\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  private getBuildMethodDescription(strategy: DeploymentStrategy, structure: ApplicationStructureDto): string {
    if (structure.topLevelBuildCommand) {
      return `docker build (running: ${structure.topLevelBuildCommand.command})`;
    }
    if (strategy === 'STATIC_FRONTEND') return 'docker build (npm run build -> nginx html)';
    if (strategy === 'JAVA_APPLICATION') return 'docker build (mvn package)';
    if (strategy === 'GO_APPLICATION') return 'docker build (go build)';
    return 'docker build (copy assets)';
  }

  private getRuntimeMethodDescription(strategy: DeploymentStrategy, structure: ApplicationStructureDto): string {
    if (structure.topLevelStartCommand) {
      return `docker run (CMD: ${structure.topLevelStartCommand.command})`;
    }
    if (strategy === 'STATIC_FRONTEND') return 'docker run (nginx -g daemon off;)';
    if (strategy === 'PYTHON_APPLICATION') return 'docker run (uvicorn main:app)';
    if (strategy === 'JAVA_APPLICATION') return 'docker run (java -jar app.jar)';
    if (strategy === 'GO_APPLICATION') return 'docker run (/app/server)';
    return 'docker run';
  }
}
