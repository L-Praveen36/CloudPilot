import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fsp from 'fs/promises';
import type { Dirent } from 'fs';
import {
  ApplicationRole,
  ConfidenceLevel,
  DetectedApplication,
  DetectedEntryPoint,
  DetectedCommand,
  DetectedPort,
  DetectedOutputDirectory,
  ApplicationRelationship,
  ApplicationStructureDto,
  DeploymentRequirement,
} from '@cloudpilot/shared';

/**
 * Phase 3.3 — Application Structure Service
 *
 * Statically inspects the acquired local repository workspace to determine:
 *  - Primary Application Role (Frontend, Backend, Fullstack, API, Worker, CLI, Library)
 *  - Sub-application discovery (Monorepos: apps/*, services/*, packages/*)
 *  - Ranked Entry Points
 *  - Declared vs Inferred Build & Start Commands
 *  - Statically detected Ports (safe .env.example, Dockerfile EXPOSE, configs)
 *  - Output Directories
 *  - Frontend / Backend Relationships
 *
 * Strict Static Analysis Guarantee:
 *  - Never executes repository code, scripts, package managers, or compilers.
 *  - Never reads secret files (.env, .env.local, .pem, .key).
 *  - Bounded recursive walk skipping ignored directories.
 */
@Injectable()
export class ApplicationStructureService {
  private readonly logger = new Logger(ApplicationStructureService.name);

  // Maximum manifest/config file size to read into memory (1 MB)
  private readonly maxConfigSizeBytes = 1024 * 1024;

  // Directories to skip during scanning
  private readonly ignoredDirectories = new Set([
    'node_modules',
    '.git',
    '.github',
    '.vscode',
    '.idea',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'target',
    'vendor',
    'coverage',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    'env',
    '.cargo',
    'pkg',
  ]);

  /**
   * Main Phase 3.3 Entry Point:
   * Statically inspects the temporary workspace and returns a deterministic ApplicationStructureDto.
   */
  async detectStructure(workspacePath: string): Promise<ApplicationStructureDto> {
    const resolvedWorkspace = path.resolve(workspacePath);

    // 1. Scan directory structure and discover candidate application paths
    const { allFiles, candidateAppPaths } = await this.discoverCandidatePaths(resolvedWorkspace);

    // 2. Analyze each candidate application path
    const detectedApplications: DetectedApplication[] = [];
    for (const appRelPath of candidateAppPaths) {
      const app = await this.analyzeApplicationAt(resolvedWorkspace, appRelPath, allFiles);
      if (app) {
        detectedApplications.push(app);
      }
    }

    // Sort detected applications deterministically by relative path
    detectedApplications.sort((a, b) => a.path.localeCompare(b.path));

    // 3. Detect relationships between applications (e.g. Frontend ↔ Backend)
    const relationships = await this.detectRelationships(
      resolvedWorkspace,
      detectedApplications,
      allFiles,
    );

    // 4. Calculate top-level properties and primary role
    const primaryRole = this.determinePrimaryRole(detectedApplications);
    const topApp = detectedApplications.find((a) => a.path === '.') || detectedApplications[0];

    // If primary role is FULLSTACK or monorepo with backend, prefer backend/API app for topLevelPort and topLevelStartCommand
    const backendApp = detectedApplications.find((a) => a.role === 'BACKEND' || a.role === 'API');
    const preferredTopApp = (primaryRole === 'FULLSTACK' && backendApp) ? backendApp : topApp;

    const topLevelEntryPoint = topApp?.entryPoint || null;
    const topLevelBuildCommand = topApp?.buildCommand || null;
    const topLevelStartCommand = preferredTopApp?.startCommand || topApp?.startCommand || null;
    const topLevelPort = preferredTopApp?.port || topApp?.port || null;
    const topLevelOutputDirectory = topApp?.outputDirectory || null;

    // Collect top-level evidence deterministically
    const evidenceSet = new Set<string>();
    if (detectedApplications.length > 1) {
      evidenceSet.add(`Discovered ${detectedApplications.length} applications in monorepo`);
    }
    for (const app of detectedApplications) {
      for (const ev of app.evidence) {
        evidenceSet.add(`${app.name}: ${ev}`);
      }
    }
    const evidence = Array.from(evidenceSet).sort();

    // Determine overall confidence
    const confidence: ConfidenceLevel =
      detectedApplications.length > 0 &&
      detectedApplications.every((a) => a.confidence === 'HIGH')
        ? 'HIGH'
        : detectedApplications.some((a) => a.confidence === 'HIGH' || a.confidence === 'MEDIUM')
          ? 'MEDIUM'
          : 'LOW';

    // 5. Detect source code environment variable requirements
    const detectedEnvironmentVariables = await this.detectSourceEnvironmentVariables(
      resolvedWorkspace,
      allFiles,
    );

    return {
      primaryRole,
      confidence,
      applications: detectedApplications,
      relationships,
      topLevelEntryPoint,
      topLevelBuildCommand,
      topLevelStartCommand,
      topLevelPort,
      topLevelOutputDirectory,
      detectedEnvironmentVariables,
      evidence,
    };
  }

  /**
   * Discovers candidate application directories under root, apps/*, packages/*, services/*, frontend, backend.
   */
  private async discoverCandidatePaths(
    workspaceRoot: string,
  ): Promise<{ allFiles: string[]; candidateAppPaths: string[] }> {
    const allFiles: string[] = [];
    const candidateAppPaths = new Set<string>();

    const walk = async (currentDir: string, currentRelative: string, depth: number) => {
      if (depth > 15) return;

      let entries: Dirent[];
      try {
        entries = await fsp.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const name = entry.name;
        const entryRelative = currentRelative ? `${currentRelative}/${name}` : name;
        const fullPath = path.join(currentDir, name);

        if (entry.isDirectory()) {
          if (this.ignoredDirectories.has(name) || entry.isSymbolicLink()) {
            continue;
          }

          // Check if this directory looks like a sub-application
          if (
            currentRelative === 'apps' ||
            currentRelative === 'packages' ||
            currentRelative === 'services' ||
            entryRelative === 'frontend' ||
            entryRelative === 'backend' ||
            entryRelative === 'client' ||
            entryRelative === 'server' ||
            entryRelative === 'api' ||
            entryRelative === 'web'
          ) {
            candidateAppPaths.add(entryRelative);
          }

          await walk(fullPath, entryRelative, depth + 1);
        } else if (entry.isFile()) {
          allFiles.push(entryRelative.split(path.sep).join('/'));
        }
      }
    };

    await walk(workspaceRoot, '', 0);

    // If sub-apps are found, include root if root has its own application files, or default to root
    if (candidateAppPaths.size === 0) {
      candidateAppPaths.add('.');
    } else {
      // Check if root itself is an application or just a workspace coordinator
      const hasRootManifest = allFiles.includes('package.json') || allFiles.includes('pyproject.toml') || allFiles.includes('pom.xml') || allFiles.includes('go.mod');
      if (hasRootManifest) {
        // If root has independent server or UI files not in sub-apps, also add root
        const hasRootSrc = allFiles.some((f) => f.startsWith('src/') || f.startsWith('app/') || f === 'server.js' || f === 'main.py');
        if (hasRootSrc) {
          candidateAppPaths.add('.');
        }
      }
    }

    return {
      allFiles: allFiles.sort(),
      candidateAppPaths: Array.from(candidateAppPaths).sort(),
    };
  }

  /**
   * Analyzes an application located at a specific directory inside the workspace.
   */
  private async analyzeApplicationAt(
    workspaceRoot: string,
    appRelPath: string,
    allWorkspaceFiles: string[],
  ): Promise<DetectedApplication | null> {
    const appDir = appRelPath === '.' ? workspaceRoot : path.join(workspaceRoot, appRelPath);
    const appName = appRelPath === '.' ? path.basename(workspaceRoot) : path.basename(appRelPath);

    // Filter files belonging to this application
    const appFiles = allWorkspaceFiles
      .filter((f) => appRelPath === '.' ? !f.includes('/') || f.startsWith('src/') || f.startsWith('app/') || f.startsWith('pages/') || f.startsWith('public/') : f.startsWith(`${appRelPath}/`))
      .map((f) => appRelPath === '.' ? f : f.substring(appRelPath.length + 1));

    // Safe manifest reading for this app
    const packageJson = await this.readJsonFileSafe(path.join(appDir, 'package.json'));
    const pyprojectToml = await this.readFileSafe(path.join(appDir, 'pyproject.toml'));
    const requirementsTxt = await this.readFileSafe(path.join(appDir, 'requirements.txt'));
    const pomXml = await this.readFileSafe(path.join(appDir, 'pom.xml'));
    const buildGradle = (await this.readFileSafe(path.join(appDir, 'build.gradle'))) || (await this.readFileSafe(path.join(appDir, 'build.gradle.kts')));
    const goMod = await this.readFileSafe(path.join(appDir, 'go.mod'));
    const cargoToml = await this.readFileSafe(path.join(appDir, 'Cargo.toml'));
    const dockerfile = await this.readFileSafe(path.join(appDir, 'Dockerfile'));
    const envExample = (await this.readFileSafe(path.join(appDir, '.env.example'))) || (await this.readFileSafe(path.join(appDir, '.env.sample')));

    const evidence: string[] = [];

    // 1. Language & Framework Detection
    const { language, framework } = this.detectLanguageAndFramework(
      appFiles,
      packageJson,
      pyprojectToml,
      requirementsTxt,
      pomXml,
      buildGradle,
      goMod,
      cargoToml,
      evidence,
    );

    // 2. Package Manager
    const packageManager = this.detectPackageManager(appFiles, pyprojectToml);

    // 3. Application Role Detection
    const role = this.detectApplicationRole(
      appFiles,
      packageJson,
      framework,
      language,
      pyprojectToml,
      requirementsTxt,
      pomXml,
      buildGradle,
      evidence,
    );

    // 4. Entry Point Detection
    const entryPoint = this.detectEntryPoint(appRelPath, appFiles, packageJson, framework, language, evidence);

    // 5. Build Command Detection
    const buildCommand = this.detectBuildCommand(packageJson, framework, language, pomXml, buildGradle, cargoToml, evidence);

    // 6. Start Command Detection
    const startCommand = this.detectStartCommand(packageJson, framework, language, entryPoint, evidence);

    // 7. Port Detection
    const port = await this.detectPort(appDir, appFiles, envExample, dockerfile, packageJson, framework, evidence);

    // 8. Output Directory Detection
    const outputDirectory = this.detectOutputDirectory(appFiles, framework, packageJson, evidence);

    // Confidence Calculation
    let confidence: ConfidenceLevel = 'LOW';
    if (framework && entryPoint && (buildCommand || startCommand)) {
      confidence = 'HIGH';
    } else if (framework || entryPoint || buildCommand || startCommand || role !== 'UNKNOWN') {
      confidence = 'MEDIUM';
    }

    return {
      name: appName,
      path: appRelPath,
      role,
      framework,
      language,
      packageManager,
      entryPoint,
      buildCommand,
      startCommand,
      port,
      outputDirectory,
      confidence,
      evidence: evidence.sort(),
    };
  }

  /**
   * Detects programming language and framework for an application.
   */
  private detectLanguageAndFramework(
    files: string[],
    pkg: any,
    pyproject: string | null,
    requirements: string | null,
    pom: string | null,
    gradle: string | null,
    goMod: string | null,
    cargo: string | null,
    evidence: string[],
  ): { language: string | null; framework: string | null } {
    const allDeps = {
      ...(pkg?.dependencies || {}),
      ...(pkg?.devDependencies || {}),
      ...(pkg?.peerDependencies || {}),
    };

    // Next.js
    if (allDeps['next'] || files.some((f) => f.startsWith('next.config.'))) {
      evidence.push('next dependency or next.config file');
      const hasTs = files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
      return { language: hasTs ? 'TypeScript' : 'JavaScript', framework: 'Next.js' };
    }

    // NestJS
    if (allDeps['@nestjs/core'] || files.includes('nest-cli.json')) {
      evidence.push('@nestjs/core dependency or nest-cli.json');
      return { language: 'TypeScript', framework: 'NestJS' };
    }

    // Vite
    if (allDeps['vite'] || files.some((f) => f.startsWith('vite.config.'))) {
      evidence.push('vite dependency or vite.config file');
      const hasTs = files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
      return { language: hasTs ? 'TypeScript' : 'JavaScript', framework: 'Vite' };
    }

    // Angular
    if (allDeps['@angular/core'] || files.includes('angular.json')) {
      evidence.push('@angular/core dependency or angular.json');
      return { language: 'TypeScript', framework: 'Angular' };
    }

    // React
    if (allDeps['react']) {
      evidence.push('react dependency');
      const hasTs = files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
      return { language: hasTs ? 'TypeScript' : 'JavaScript', framework: 'React' };
    }

    // Express
    if (allDeps['express']) {
      evidence.push('express dependency');
      const hasTs = files.some((f) => f.endsWith('.ts'));
      return { language: hasTs ? 'TypeScript' : 'JavaScript', framework: 'Express' };
    }

    // Fastify
    if (allDeps['fastify']) {
      evidence.push('fastify dependency');
      const hasTs = files.some((f) => f.endsWith('.ts'));
      return { language: hasTs ? 'TypeScript' : 'JavaScript', framework: 'Fastify' };
    }

    // General Node / JS / TS
    if (pkg || files.some((f) => f.endsWith('.ts') || f.endsWith('.js'))) {
      const hasTs = files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
      return { language: hasTs ? 'TypeScript' : 'JavaScript', framework: null };
    }

    // Python Frameworks
    const pythonContent = ((requirements || '') + '\n' + (pyproject || '')).toLowerCase();
    if (pythonContent.includes('fastapi')) {
      evidence.push('fastapi in python dependencies');
      return { language: 'Python', framework: 'FastAPI' };
    }
    if (pythonContent.includes('django') || files.includes('manage.py')) {
      evidence.push('django in python dependencies or manage.py');
      return { language: 'Python', framework: 'Django' };
    }
    if (pythonContent.includes('flask')) {
      evidence.push('flask in python dependencies');
      return { language: 'Python', framework: 'Flask' };
    }
    if (pyproject || requirements || files.some((f) => f.endsWith('.py'))) {
      return { language: 'Python', framework: null };
    }

    // Java Spring Boot
    const javaContent = ((pom || '') + '\n' + (gradle || '')).toLowerCase();
    if (javaContent.includes('spring-boot') || javaContent.includes('springframework.boot')) {
      evidence.push('spring-boot in maven/gradle dependencies');
      return { language: 'Java', framework: 'Spring Boot' };
    }
    if (pom || gradle || files.some((f) => f.endsWith('.java'))) {
      return { language: 'Java', framework: null };
    }

    // Go
    if (goMod || files.some((f) => f.endsWith('.go'))) {
      evidence.push('go.mod file or Go source files');
      return { language: 'Go', framework: 'Go' };
    }

    // Rust
    if (cargo || files.some((f) => f.endsWith('.rs'))) {
      evidence.push('Cargo.toml file or Rust source files');
      return { language: 'Rust', framework: null };
    }

    return { language: null, framework: null };
  }

  /**
   * Deterministically detects the role of an application (FRONTEND, BACKEND, FULLSTACK, API, WORKER, CLI, LIBRARY, SERVICE, UNKNOWN).
   */
  private detectApplicationRole(
    files: string[],
    pkg: any,
    framework: string | null,
    language: string | null,
    pyproject: string | null,
    requirements: string | null,
    pom: string | null,
    gradle: string | null,
    evidence: string[],
  ): ApplicationRole {
    const allDeps = {
      ...(pkg?.dependencies || {}),
      ...(pkg?.devDependencies || {}),
    };

    // 1. Library check: has main/module/exports and no start script or server/UI frameworks
    if (pkg && (pkg.main || pkg.module || pkg.exports) && !pkg.scripts?.start && !pkg.scripts?.dev && !allDeps['express'] && !allDeps['@nestjs/core'] && !allDeps['next'] && !allDeps['react']) {
      evidence.push('package.json contains library exports without runnable server/UI start scripts');
      return 'LIBRARY';
    }

    // 2. Fullstack frameworks
    if (framework === 'Next.js' || framework === 'Nuxt' || framework === 'Remix') {
      evidence.push(`${framework} full-stack framework`);
      return 'FULLSTACK';
    }

    // 3. Frontend frameworks & UI assets
    const hasHtml = files.includes('index.html') || files.includes('public/index.html');
    const hasUiDirs = files.some((f) => f.startsWith('src/app') || f.startsWith('src/pages') || f.startsWith('app/') || f.startsWith('pages/') || f.startsWith('public/'));
    const isFrontendFramework = framework === 'Vite' || framework === 'React' || framework === 'Angular' || framework === 'Vue' || framework === 'Svelte';

    if (isFrontendFramework || (hasHtml && hasUiDirs)) {
      evidence.push('Frontend UI framework and web assets detected');
      return 'FRONTEND';
    }

    // 4. CLI application
    if (pkg?.bin || files.some((f) => f.startsWith('bin/')) || ((pyproject || '').includes('[tool.poetry.scripts]') || (pyproject || '').includes('[project.scripts]'))) {
      evidence.push('Executable CLI binary or scripts definition detected');
      return 'CLI';
    }

    // 5. Worker application (e.g. BullMQ, Celery, Kafka consumers without HTTP ports)
    const depStr = JSON.stringify(allDeps) + (requirements || '') + (pyproject || '');
    if (depStr.includes('bullmq') || depStr.includes('celery') || depStr.includes('kafkajs') || depStr.includes('amqplib') || depStr.includes('pika')) {
      const hasHttpServer = allDeps['express'] || allDeps['@nestjs/core'] || depStr.includes('fastapi') || depStr.includes('flask');
      if (!hasHttpServer) {
        evidence.push('Queue / worker consumer dependencies detected without HTTP server');
        return 'WORKER';
      }
    }

    // 6. Backend / API frameworks
    if (framework === 'NestJS' || framework === 'Express' || framework === 'Fastify' || framework === 'FastAPI' || framework === 'Django' || framework === 'Flask' || framework === 'Spring Boot') {
      const isApi = framework === 'FastAPI' || framework === 'NestJS' || files.some((f) => f.includes('controller') || f.includes('routes') || f.includes('api/'));
      evidence.push(`${framework} backend application`);
      return isApi ? 'API' : 'BACKEND';
    }

    // 7. Go / Java / Python generic backend
    if (language === 'Go' || language === 'Java' || language === 'Python') {
      evidence.push(`${language} server backend`);
      return 'BACKEND';
    }

    if (pkg?.scripts?.start || files.includes('server.js') || files.includes('app.js')) {
      evidence.push('Server entrypoint file or start script');
      return 'BACKEND';
    }

    return 'UNKNOWN';
  }

  /**
   * Deterministically finds and ranks candidate entry points.
   */
  private detectEntryPoint(
    appRelPath: string,
    files: string[],
    pkg: any,
    framework: string | null,
    language: string | null,
    evidence: string[],
  ): DetectedEntryPoint | null {
    const prefix = appRelPath === '.' ? '' : `${appRelPath}/`;

    // Candidate ranking list (highest priority first)
    const rankedCandidates: { file: string; reason: string }[] = [
      // Framework-specific roots
      { file: 'app/page.tsx', reason: 'Next.js App Router root page' },
      { file: 'src/app/page.tsx', reason: 'Next.js App Router root page' },
      { file: 'pages/index.tsx', reason: 'Next.js Pages Router index' },
      { file: 'src/pages/index.tsx', reason: 'Next.js Pages Router index' },
      { file: 'src/main.tsx', reason: 'React/Vite root application entry point' },
      { file: 'src/main.ts', reason: 'NestJS / Angular root main entry point' },
      { file: 'src/index.tsx', reason: 'React root application entry point' },
      { file: 'src/index.ts', reason: 'TypeScript application entry point' },
      { file: 'src/server.ts', reason: 'TypeScript server entry point' },
      { file: 'server.ts', reason: 'TypeScript server entry point' },
      { file: 'src/app.ts', reason: 'TypeScript application entry point' },
      { file: 'app.ts', reason: 'TypeScript application entry point' },
      { file: 'src/main.jsx', reason: 'React root application entry point' },
      { file: 'src/index.jsx', reason: 'React root application entry point' },
      { file: 'src/index.js', reason: 'JavaScript application entry point' },
      { file: 'index.js', reason: 'Node.js default entry point' },
      { file: 'server.js', reason: 'Node.js server entry point' },
      { file: 'app.js', reason: 'Node.js app entry point' },
      { file: 'main.js', reason: 'Node.js main entry point' },

      // Python candidates
      { file: 'main.py', reason: 'Python main application entry point' },
      { file: 'app.py', reason: 'Python Flask/FastAPI application entry point' },
      { file: 'server.py', reason: 'Python server entry point' },
      { file: 'manage.py', reason: 'Django management entry point' },
      { file: 'wsgi.py', reason: 'Python WSGI entry point' },
      { file: 'asgi.py', reason: 'Python ASGI entry point' },

      // Go candidates
      { file: 'main.go', reason: 'Go main application entry point' },
      { file: 'cmd/main.go', reason: 'Go command entry point' },
      { file: 'cmd/server/main.go', reason: 'Go server command entry point' },
      { file: 'cmd/api/main.go', reason: 'Go API command entry point' },

      // Rust candidates
      { file: 'src/main.rs', reason: 'Rust main binary entry point' },
      { file: 'src/lib.rs', reason: 'Rust library root' },
    ];

    // Check package.json main field
    if (pkg?.main && files.includes(pkg.main)) {
      evidence.push(`Entry point specified in package.json main: ${pkg.main}`);
      return {
        path: `${prefix}${pkg.main}`,
        isDefault: false,
        evidence: `package.json main field`,
      };
    }

    // Match against ranked candidates
    for (const candidate of rankedCandidates) {
      if (files.includes(candidate.file)) {
        evidence.push(`Found entry point: ${candidate.file} (${candidate.reason})`);
        return {
          path: `${prefix}${candidate.file}`,
          isDefault: true,
          evidence: candidate.reason,
        };
      }
    }

    // Java Spring Boot search: find any file in src/main/java named *Application.java
    const javaApp = files.find((f) => f.startsWith('src/main/java/') && f.endsWith('Application.java'));
    if (javaApp) {
      evidence.push(`Found Spring Boot Application class: ${javaApp}`);
      return {
        path: `${prefix}${javaApp}`,
        isDefault: true,
        evidence: 'Spring Boot Application class',
      };
    }

    // Fallback: any *.go or *.py if single file exists
    const singlePy = files.find((f) => f.endsWith('.py'));
    if (singlePy) {
      return {
        path: `${prefix}${singlePy}`,
        isDefault: true,
        evidence: 'Python source file',
      };
    }

    return null;
  }

  /**
   * Detects declared or inferred build command.
   */
  private detectBuildCommand(
    pkg: any,
    framework: string | null,
    language: string | null,
    pom: string | null,
    gradle: string | null,
    cargo: string | null,
    evidence: string[],
  ): DetectedCommand | null {
    // 1. Explicitly declared in package.json
    if (pkg?.scripts?.build) {
      evidence.push(`Declared build script in package.json: ${pkg.scripts.build}`);
      return {
        command: 'npm run build',
        isDeclared: true,
        source: 'package.json scripts.build',
      };
    }

    // 2. Framework-inferred commands
    if (framework === 'Next.js') {
      evidence.push('Inferred build command from Next.js convention');
      return { command: 'next build', isDeclared: false, source: 'Next.js framework convention' };
    }
    if (framework === 'Vite') {
      evidence.push('Inferred build command from Vite convention');
      return { command: 'vite build', isDeclared: false, source: 'Vite framework convention' };
    }
    if (framework === 'NestJS') {
      evidence.push('Inferred build command from NestJS convention');
      return { command: 'nest build', isDeclared: false, source: 'NestJS framework convention' };
    }
    if (framework === 'Angular') {
      evidence.push('Inferred build command from Angular convention');
      return { command: 'ng build', isDeclared: false, source: 'Angular framework convention' };
    }
    if (pom) {
      evidence.push('Inferred build command from Maven pom.xml');
      return { command: 'mvn package', isDeclared: false, source: 'Maven pom.xml' };
    }
    if (gradle) {
      evidence.push('Inferred build command from Gradle configuration');
      return { command: 'gradle build', isDeclared: false, source: 'Gradle build' };
    }
    if (language === 'Go') {
      evidence.push('Inferred build command from Go convention');
      return { command: 'go build', isDeclared: false, source: 'Go convention' };
    }
    if (cargo) {
      evidence.push('Inferred build command from Cargo.toml');
      return { command: 'cargo build --release', isDeclared: false, source: 'Cargo convention' };
    }

    return null;
  }

  /**
   * Detects declared or inferred start command.
   */
  private detectStartCommand(
    pkg: any,
    framework: string | null,
    language: string | null,
    entryPoint: DetectedEntryPoint | null,
    evidence: string[],
  ): DetectedCommand | null {
    // 1. Explicitly declared in package.json
    if (pkg?.scripts?.start) {
      evidence.push(`Declared start script in package.json: ${pkg.scripts.start}`);
      return {
        command: 'npm start',
        isDeclared: true,
        source: 'package.json scripts.start',
      };
    }

    // 2. Framework-inferred commands
    if (framework === 'Next.js') {
      evidence.push('Inferred start command from Next.js convention');
      return { command: 'next start', isDeclared: false, source: 'Next.js framework convention' };
    }
    if (framework === 'Vite') {
      evidence.push('Inferred start command from Vite convention');
      return { command: 'vite preview', isDeclared: false, source: 'Vite framework convention' };
    }
    if (framework === 'NestJS') {
      evidence.push('Inferred start command from NestJS convention');
      return { command: 'node dist/main', isDeclared: false, source: 'NestJS production convention' };
    }
    if (framework === 'FastAPI') {
      evidence.push('Inferred start command from FastAPI convention');
      return { command: 'uvicorn main:app --host 0.0.0.0 --port 8000', isDeclared: false, source: 'FastAPI convention' };
    }
    if (framework === 'Django') {
      evidence.push('Inferred start command from Django convention');
      return { command: 'gunicorn wsgi:application', isDeclared: false, source: 'Django WSGI convention' };
    }
    if (framework === 'Flask') {
      evidence.push('Inferred start command from Flask convention');
      return { command: 'flask run --host=0.0.0.0', isDeclared: false, source: 'Flask convention' };
    }
    if (framework === 'Spring Boot') {
      evidence.push('Inferred start command from Spring Boot convention');
      return { command: 'java -jar target/app.jar', isDeclared: false, source: 'Spring Boot jar convention' };
    }
    if (language === 'Go') {
      evidence.push('Inferred start command from Go convention');
      return { command: 'go run .', isDeclared: false, source: 'Go convention' };
    }
    if (entryPoint && (entryPoint.path.endsWith('.js') || entryPoint.path.endsWith('.ts'))) {
      return { command: `node ${entryPoint.path}`, isDeclared: false, source: 'Node entry point' };
    }

    return null;
  }

  /**
   * Statically inspects safe sources (.env.example, Dockerfile EXPOSE, server source files, framework defaults) for ports.
   */
  private async detectPort(
    appDir: string,
    files: string[],
    envExample: string | null,
    dockerfile: string | null,
    pkg: any,
    framework: string | null,
    evidence: string[],
  ): Promise<DetectedPort | null> {
    // 1. Safe .env.example / .env.sample inspection
    if (envExample) {
      const match = envExample.match(/(?:PORT|APP_PORT|SERVER_PORT|HTTP_PORT)\s*=\s*(\d{2,5})/i);
      if (match) {
        const portNum = parseInt(match[1], 10);
        if (portNum >= 80 && portNum <= 65535) {
          evidence.push(`Detected port ${portNum} from .env.example`);
          return { port: portNum, source: '.env.example configuration', confidence: 'HIGH' };
        }
      }
    }

    const envFiles = ['.env.sample', '.env.local', '.env.development', '.env'];
    for (const envFile of envFiles) {
      if (files.includes(envFile)) {
        const envContent = await this.readFileSafe(path.join(appDir, envFile));
        if (envContent) {
          const match = envContent.match(/(?:PORT|APP_PORT|SERVER_PORT|HTTP_PORT)\s*=\s*(\d{2,5})/i);
          if (match) {
            const portNum = parseInt(match[1], 10);
            if (portNum >= 80 && portNum <= 65535) {
              evidence.push(`Detected port ${portNum} from ${envFile}`);
              return { port: portNum, source: `${envFile} configuration`, confidence: 'HIGH' };
            }
          }
        }
      }
    }

    // 2. Dockerfile EXPOSE directive
    if (dockerfile) {
      const match = dockerfile.match(/EXPOSE\s+(\d{2,5})/i);
      if (match) {
        const portNum = parseInt(match[1], 10);
        if (portNum >= 80 && portNum <= 65535) {
          evidence.push(`Detected port ${portNum} from Dockerfile EXPOSE`);
          return { port: portNum, source: 'Dockerfile EXPOSE', confidence: 'HIGH' };
        }
      }
    }

    // 3. Source code inspection for server port listening
    const serverFileCandidates = [
      'index.js',
      'server.js',
      'app.js',
      'main.js',
      'src/index.js',
      'src/server.js',
      'src/app.js',
      'src/main.js',
      'src/index.ts',
      'src/server.ts',
      'src/app.ts',
      'src/main.ts',
      'main.py',
      'app.py',
      'server.py',
    ];

    for (const candidate of serverFileCandidates) {
      if (files.includes(candidate)) {
        const content = await this.readFileSafe(path.join(appDir, candidate));
        if (content) {
          const portPatterns = [
            /(?:process\.env\.(?:PORT|APP_PORT|SERVER_PORT)\s*\|\|\s*)(\d{2,5})/i,
            /(?:app|server|httpServer)\.listen\(\s*(?:process\.env\.(?:PORT|APP_PORT|SERVER_PORT)\s*\|\|\s*)?(\d{2,5})/i,
            /(?:const|let|var)\s+PORT\s*=\s*(?:process\.env\.(?:PORT|APP_PORT|SERVER_PORT)\s*\|\|\s*)?(\d{2,5})/i,
            /uvicorn\.run\(.*port\s*=\s*(\d{2,5})/i,
          ];

          for (const pattern of portPatterns) {
            const match = content.match(pattern);
            if (match) {
              const portNum = parseInt(match[1], 10);
              if (portNum >= 80 && portNum <= 65535) {
                evidence.push(`Detected port ${portNum} from source code (${candidate})`);
                return { port: portNum, source: `Source code (${candidate})`, confidence: 'HIGH' };
              }
            }
          }
        }
      }
    }

    // 4. Framework default ports
    if (framework === 'Next.js') {
      return { port: 3000, source: 'Next.js default port', confidence: 'MEDIUM' };
    }
    if (framework === 'NestJS') {
      return { port: 3000, source: 'NestJS default port', confidence: 'MEDIUM' };
    }
    if (framework === 'Express') {
      return { port: 5000, source: 'Express default port', confidence: 'MEDIUM' };
    }
    if (framework === 'Fastify') {
      return { port: 3000, source: 'Fastify default port', confidence: 'MEDIUM' };
    }
    if (framework === 'Vite') {
      return { port: 5173, source: 'Vite default port', confidence: 'MEDIUM' };
    }
    if (framework === 'React') {
      return { port: 3000, source: 'React dev default port', confidence: 'LOW' };
    }
    if (framework === 'Angular') {
      return { port: 4200, source: 'Angular default port', confidence: 'MEDIUM' };
    }
    if (framework === 'FastAPI' || framework === 'Django') {
      return { port: 8000, source: `${framework} default port`, confidence: 'MEDIUM' };
    }
    if (framework === 'Flask') {
      return { port: 5000, source: 'Flask default port', confidence: 'MEDIUM' };
    }
    if (framework === 'Spring Boot') {
      return { port: 8080, source: 'Spring Boot default port', confidence: 'MEDIUM' };
    }
    if (framework === 'Go') {
      return { port: 8080, source: 'Go default port', confidence: 'MEDIUM' };
    }

    return null;
  }

  /**
   * Detects configured or conventional output directory.
   */
  private detectOutputDirectory(
    files: string[],
    framework: string | null,
    pkg: any,
    evidence: string[],
  ): DetectedOutputDirectory | null {
    const allDeps = {
      ...(pkg?.dependencies || {}),
      ...(pkg?.devDependencies || {}),
    };
    const buildScript = pkg?.scripts?.build || '';

    // 1. Next.js
    if (framework === 'Next.js' || allDeps['next']) {
      evidence.push('Output directory .next from Next.js convention');
      return { path: '.next', isConfigured: false, source: 'Next.js framework convention' };
    }

    // 2. Nuxt
    if (framework === 'Nuxt' || allDeps['nuxt']) {
      evidence.push('Output directory .output from Nuxt convention');
      return { path: '.output', isConfigured: false, source: 'Nuxt framework convention' };
    }

    // 3. SvelteKit
    if (allDeps['@sveltejs/kit']) {
      evidence.push('Output directory build from SvelteKit convention');
      return { path: 'build', isConfigured: false, source: 'SvelteKit convention' };
    }

    // 4. Create React App / react-scripts
    if (allDeps['react-scripts'] || buildScript.includes('react-scripts build') || buildScript.includes('react-scripts')) {
      evidence.push('Output directory build from react-scripts / Create React App convention');
      return { path: 'build', isConfigured: false, source: 'react-scripts convention' };
    }

    // 5. Vite
    if (framework === 'Vite' || allDeps['vite'] || buildScript.includes('vite build') || buildScript.includes('vite')) {
      evidence.push('Output directory dist from Vite convention');
      return { path: 'dist', isConfigured: false, source: 'Vite framework convention' };
    }

    // 6. Generic React
    if (framework === 'React') {
      if (allDeps['react-scripts'] || buildScript.includes('react-scripts')) {
        evidence.push('Output directory build from Create React App convention');
        return { path: 'build', isConfigured: false, source: 'Create React App convention' };
      }
      if (allDeps['vite'] || buildScript.includes('vite')) {
        evidence.push('Output directory dist from Vite convention');
        return { path: 'dist', isConfigured: false, source: 'Vite convention' };
      }
      if (buildScript.includes('build')) {
        evidence.push('Output directory build from React build convention');
        return { path: 'build', isConfigured: false, source: 'React build convention' };
      }
      evidence.push('Output directory dist from React convention');
      return { path: 'dist', isConfigured: false, source: 'React convention' };
    }

    // 7. NestJS
    if (framework === 'NestJS' || files.includes('nest-cli.json') || allDeps['@nestjs/core']) {
      evidence.push('Output directory dist from NestJS convention');
      return { path: 'dist', isConfigured: false, source: 'NestJS framework convention' };
    }

    // 8. Angular
    if (framework === 'Angular' || allDeps['@angular/core'] || files.includes('angular.json')) {
      evidence.push('Output directory dist from Angular convention');
      return { path: 'dist', isConfigured: false, source: 'Angular framework convention' };
    }

    // 9. Maven
    if (files.includes('pom.xml')) {
      evidence.push('Output directory target from Maven convention');
      return { path: 'target', isConfigured: false, source: 'Maven convention' };
    }

    // 10. Gradle
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      evidence.push('Output directory build from Gradle convention');
      return { path: 'build', isConfigured: false, source: 'Gradle convention' };
    }

    return null;
  }

  /**
   * Maps client-server or proxy relationships between detected applications.
   */
  private async detectRelationships(
    workspaceRoot: string,
    applications: DetectedApplication[],
    allFiles: string[],
  ): Promise<ApplicationRelationship[]> {
    const relationships: ApplicationRelationship[] = [];
    const frontendApps = applications.filter((a) => a.role === 'FRONTEND' || a.role === 'FULLSTACK');
    const backendApps = applications.filter((a) => a.role === 'BACKEND' || a.role === 'API');

    for (const fe of frontendApps) {
      for (const be of backendApps) {
        const evidence: string[] = [];
        let relType: ApplicationRelationship['relationshipType'] = 'UNKNOWN';

        // Check for Vite proxy or package proxy in frontend
        const fePkg = await this.readJsonFileSafe(path.join(workspaceRoot, fe.path, 'package.json'));
        if (fePkg?.proxy) {
          relType = 'PROXY';
          evidence.push(`Proxy configured in ${fe.path}/package.json: ${fePkg.proxy}`);
        }

        // Check for .env.example API URLs in frontend
        const feEnv = await this.readFileSafe(path.join(workspaceRoot, fe.path, '.env.example'));
        if (feEnv && (feEnv.includes('API_URL') || feEnv.includes('BACKEND_URL'))) {
          relType = 'CLIENT_SERVER';
          evidence.push(`API URL reference found in ${fe.path}/.env.example`);
        }

        // Default Monorepo client-server pairing if in apps/
        if (relType === 'UNKNOWN' && fe.path.startsWith('apps/') && be.path.startsWith('apps/')) {
          relType = 'CLIENT_SERVER';
          evidence.push(`Monorepo co-located frontend (${fe.name}) and backend (${be.name}) applications`);
        }

        if (relType !== 'UNKNOWN') {
          relationships.push({
            source: fe.name,
            target: be.name,
            relationshipType: relType,
            evidence: evidence.sort(),
          });
        }
      }
    }

    // Sort relationships deterministically
    return relationships.sort((a, b) => `${a.source}->${a.target}`.localeCompare(`${b.source}->${b.target}`));
  }

  /**
   * Deterministically resolves the primary repository role.
   */
  private determinePrimaryRole(applications: DetectedApplication[]): ApplicationRole {
    if (applications.length === 0) return 'UNKNOWN';

    const roles = applications.map((a) => a.role);
    const hasFrontend = roles.includes('FRONTEND');
    const hasBackend = roles.includes('BACKEND') || roles.includes('API');

    if (hasFrontend && hasBackend) {
      return 'FULLSTACK';
    }
    if (roles.includes('FULLSTACK')) {
      return 'FULLSTACK';
    }
    if (hasFrontend) {
      return 'FRONTEND';
    }
    if (roles.includes('API')) {
      return 'API';
    }
    if (hasBackend) {
      return 'BACKEND';
    }
    if (roles.includes('WORKER')) {
      return 'WORKER';
    }
    if (roles.includes('CLI')) {
      return 'CLI';
    }
    if (roles.includes('LIBRARY')) {
      return 'LIBRARY';
    }
    if (roles.includes('SERVICE')) {
      return 'SERVICE';
    }

    return 'UNKNOWN';
  }

  /**
   * Detects package manager from files.
   */
  private detectPackageManager(files: string[], pyproject: string | null): string | null {
    if (files.includes('pnpm-lock.yaml') || files.includes('pnpm-workspace.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    if (files.includes('package-lock.json') || files.includes('package.json')) return 'npm';
    if (files.includes('poetry.lock') || (pyproject && pyproject.includes('[tool.poetry]'))) return 'poetry';
    if (files.includes('Pipfile') || files.includes('Pipfile.lock')) return 'pipenv';
    if (files.includes('requirements.txt') || pyproject) return 'pip';
    if (files.includes('pom.xml')) return 'maven';
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) return 'gradle';
    if (files.includes('go.mod')) return 'go';
    if (files.includes('Cargo.toml')) return 'cargo';
    return null;
  }

  /**
   * Safely reads a file with size bounds and error handling.
   */
  private async readFileSafe(filePath: string): Promise<string | null> {
    try {
      const stat = await fsp.stat(filePath);
      if (stat.size > this.maxConfigSizeBytes) {
        return null;
      }
      return await fsp.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Statically inspects source files for environment variable references (e.g. process.env.X, os.environ['X']).
   * Distinguishes required variables from those with fallbacks.
   */
  public async detectSourceEnvironmentVariables(
    workspaceRoot: string,
    allFiles: string[],
  ): Promise<DeploymentRequirement[]> {
    const requirementsMap = new Map<string, DeploymentRequirement>();

    const sourceExtensions = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py']);
    const candidateFiles = allFiles.filter((f) => {
      const ext = path.extname(f);
      return sourceExtensions.has(ext);
    });

    // Prioritize entry points and server files
    candidateFiles.sort((a, b) => {
      const aPrio = a.includes('server') || a.includes('index') || a.includes('app') || a.includes('main') ? 0 : 1;
      const bPrio = b.includes('server') || b.includes('index') || b.includes('app') || b.includes('main') ? 0 : 1;
      return aPrio - bPrio;
    });

    const maxFilesToScan = Math.min(candidateFiles.length, 50);

    for (let i = 0; i < maxFilesToScan; i++) {
      const relFile = candidateFiles[i];
      const fullPath = path.join(workspaceRoot, relFile);
      const content = await this.readFileSafe(fullPath);
      if (!content) continue;

      // 1. JavaScript / TypeScript process.env detection
      const jsEnvRegex = /process\.env(?:\.([A-Za-z0-9_]+)|\[['"]([A-Za-z0-9_]+)['"]\])/g;
      let match: RegExpExecArray | null;

      while ((match = jsEnvRegex.exec(content)) !== null) {
        const varName = match[1] || match[2];
        if (!varName || /^\d+$/.test(varName)) continue;

        const postIndex = match.index + match[0].length;
        const postSnippet = content.substring(postIndex, postIndex + 60).trim();

        const hasFallback =
          postSnippet.startsWith('||') ||
          postSnippet.startsWith('??') ||
          varName === 'PORT' ||
          varName === 'NODE_ENV' ||
          varName === 'HOST';

        const isRequired = !hasFallback;
        const confidence: ConfidenceLevel = (varName === 'OPENAI_API_KEY' || varName.endsWith('_KEY') || varName.endsWith('_SECRET') || varName.endsWith('_TOKEN') || varName === 'PORT' || varName === 'NODE_ENV')
          ? 'HIGH'
          : 'MEDIUM';

        const existing = requirementsMap.get(varName);
        if (!existing || (!existing.required && isRequired)) {
          requirementsMap.set(varName, {
            name: varName,
            required: isRequired,
            documented: false,
            source: `source-code (${relFile})`,
            confidence,
          });
        }
      }

      // 2. Python os.environ detection
      const pyEnvRegex = /(?:os\.environ\[['"]([A-Za-z0-9_]+)['"]\]|os\.(?:environ\.get|getenv)\(['"]([A-Za-z0-9_]+)['"](?:\s*,\s*([^)]+))?\))/g;
      let pyMatch: RegExpExecArray | null;

      while ((pyMatch = pyEnvRegex.exec(content)) !== null) {
        const varName = pyMatch[1] || pyMatch[2];
        if (!varName) continue;
        const pyDefault = pyMatch[3];

        const hasFallback = Boolean(pyDefault) || varName === 'PORT' || varName === 'ENV';
        const isRequired = !hasFallback;
        const confidence: ConfidenceLevel = (varName.endsWith('_KEY') || varName.endsWith('_SECRET') || varName.endsWith('_TOKEN') || varName === 'PORT')
          ? 'HIGH'
          : 'MEDIUM';

        const existing = requirementsMap.get(varName);
        if (!existing || (!existing.required && isRequired)) {
          requirementsMap.set(varName, {
            name: varName,
            required: isRequired,
            documented: false,
            source: `source-code (${relFile})`,
            confidence,
          });
        }
      }
    }

    return Array.from(requirementsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Safely reads and parses a JSON file.
   */
  private async readJsonFileSafe(filePath: string): Promise<any | null> {
    const content = await this.readFileSafe(filePath);
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

