import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fsp from 'fs/promises';
import type { Dirent } from 'fs';
import { ProjectType } from '@cloudpilot/shared';

export interface AnalysisInput {
  filePaths: string[];
  manifests?: {
    packageJson?: any;
    pyprojectToml?: string | null;
    requirementsTxt?: string | null;
    pomXml?: string | null;
    buildGradle?: string | null;
    goMod?: string | null;
  };
}

export interface AnalysisResult {
  projectType: ProjectType;
  primaryLanguage: string | null;
  framework: string | null;
  packageManager: string | null;
  isMonorepo: boolean;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasEnvExample: boolean;
  detectedFiles: string[];
}

/**
 * Phase 3.2 — Repository Analyzer Service
 *
 * Performs deterministic static analysis on an acquired local repository workspace.
 * Never executes repository scripts, package managers, or application code.
 */
@Injectable()
export class RepositoryAnalyzerService {
  private readonly logger = new Logger(RepositoryAnalyzerService.name);

  // Maximum manifest file size to read into memory (1 MB)
  private readonly maxManifestSizeBytes = 1024 * 1024;

  // Directories to completely skip during analysis
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

  // Common recognized configuration and manifest patterns
  private readonly recognizedPatterns = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'turbo.json',
    'nx.json',
    'lerna.json',
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.ts',
    'angular.json',
    'nest-cli.json',
    'webpack.config.js',
    'webpack.config.ts',
    'babel.config.js',
    'babel.config.json',
    'requirements.txt',
    'pyproject.toml',
    'poetry.lock',
    'Pipfile',
    'Pipfile.lock',
    'manage.py',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts',
    'go.mod',
    'go.sum',
    'Cargo.toml',
    'Cargo.lock',
    'composer.json',
    'composer.lock',
    'Gemfile',
    'Gemfile.lock',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
    '.env.example',
    '.env.sample',
    '.env.template',
    'README.md',
    'README',
  ];

  // Extension to programming language mapping
  private readonly extensionLanguageMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.css': 'CSS',
    '.scss': 'CSS',
    '.sass': 'CSS',
    '.less': 'CSS',
    '.c': 'C',
    '.h': 'C',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.hpp': 'C++',
    '.rs': 'Rust',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.sh': 'Shell',
    '.bash': 'Shell',
    '.zsh': 'Shell',
  };

  /**
   * Primary Phase 3.2 Entry Point:
   * Analyzes an on-disk repository workspace directory statically and deterministically.
   */
  async analyzeWorkspace(workspacePath: string): Promise<AnalysisResult> {
    const resolvedWorkspace = path.resolve(workspacePath);

    // 1. Traverse workspace, collecting relative file paths & language statistics
    const { filePaths, languageCounts } = await this.scanWorkspace(resolvedWorkspace);

    // 2. Identify all recognized configuration/manifest files (sorted alphabetically, capped at 50)
    const detectedFiles = this.findDetectedFiles(filePaths);

    // 3. Flags: Dockerfile, Docker Compose, Env Example
    const hasDockerfile = filePaths.some((p) => {
      const lower = p.toLowerCase();
      return lower === 'dockerfile' || lower.endsWith('/dockerfile');
    });

    const hasDockerCompose = filePaths.some((p) => {
      const base = p.split('/').pop()?.toLowerCase();
      return (
        base === 'docker-compose.yml' ||
        base === 'docker-compose.yaml' ||
        base === 'compose.yml' ||
        base === 'compose.yaml'
      );
    });

    const hasEnvExample = filePaths.some((p) => {
      const base = p.split('/').pop()?.toLowerCase();
      return base === '.env.example' || base === '.env.sample' || base === '.env.template';
    });

    // 4. Safe manifest reading from disk
    const manifests = await this.readManifestsFromDisk(resolvedWorkspace, filePaths);

    // 5. Monorepo Detection
    const isMonorepo = this.detectMonorepo(filePaths, manifests.packageJson);

    // 6. Package Manager Detection
    const packageManager = this.detectPackageManager(filePaths, manifests);

    // 7. Language, Framework & Project Type Detection
    const techStack = this.detectTechStackFromWorkspace(
      filePaths,
      manifests,
      languageCounts,
      hasDockerfile,
    );

    return {
      projectType: techStack.projectType,
      primaryLanguage: techStack.primaryLanguage,
      framework: techStack.framework,
      packageManager,
      isMonorepo,
      hasDockerfile,
      hasDockerCompose,
      hasEnvExample,
      detectedFiles,
    };
  }

  /**
   * Backward-compatible in-memory analysis helper (used when full workspace is not on disk).
   */
  analyze(input: AnalysisInput): AnalysisResult {
    const filePaths = input.filePaths || [];
    const manifests = input.manifests || {};

    const detectedFiles = this.findDetectedFiles(filePaths);

    const hasDockerfile = filePaths.some((p) => {
      const lower = p.toLowerCase();
      return lower === 'dockerfile' || lower.endsWith('/dockerfile');
    });

    const hasDockerCompose = filePaths.some((p) => {
      const base = p.split('/').pop()?.toLowerCase();
      return (
        base === 'docker-compose.yml' ||
        base === 'docker-compose.yaml' ||
        base === 'compose.yml' ||
        base === 'compose.yaml'
      );
    });

    const hasEnvExample = filePaths.some((p) => {
      const base = p.split('/').pop()?.toLowerCase();
      return base === '.env.example' || base === '.env.sample' || base === '.env.template';
    });

    const isMonorepo = this.detectMonorepo(filePaths, manifests.packageJson);
    const packageManager = this.detectPackageManager(filePaths, manifests);

    // Compute basic language counts from in-memory filePaths
    const languageCounts = new Map<string, number>();
    for (const p of filePaths) {
      const ext = path.extname(p).toLowerCase();
      const lang = this.extensionLanguageMap[ext];
      if (lang) {
        languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
      }
    }

    const techStack = this.detectTechStackFromWorkspace(
      filePaths,
      manifests,
      languageCounts,
      hasDockerfile,
    );

    return {
      projectType: techStack.projectType,
      primaryLanguage: techStack.primaryLanguage,
      framework: techStack.framework,
      packageManager,
      isMonorepo,
      hasDockerfile,
      hasDockerCompose,
      hasEnvExample,
      detectedFiles,
    };
  }

  /**
   * Recursively scans the workspace, filtering ignored directories, and collecting
   * normalized POSIX-relative file paths and extension language counts.
   */
  private async scanWorkspace(
    workspaceRoot: string,
  ): Promise<{ filePaths: string[]; languageCounts: Map<string, number> }> {
    const filePaths: string[] = [];
    const languageCounts = new Map<string, number>();

    const walk = async (currentDir: string, currentRelative: string, depth: number) => {
      if (depth > 20) return; // Prevent excessive recursion

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

        // Filter ignored directories
        if (entry.isDirectory()) {
          if (this.ignoredDirectories.has(name)) {
            continue;
          }
          if (entry.isSymbolicLink()) {
            // Guard against symlink recursion/escapes
            continue;
          }
          await walk(fullPath, entryRelative, depth + 1);
        } else if (entry.isFile()) {
          // Normalize to POSIX path separator
          const posixPath = entryRelative.split(path.sep).join('/');
          filePaths.push(posixPath);

          // Track language frequency
          const ext = path.extname(name).toLowerCase();
          const lang = this.extensionLanguageMap[ext];
          if (lang) {
            languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
          }
        }
      }
    };

    await walk(workspaceRoot, '', 0);
    return { filePaths, languageCounts };
  }

  /**
   * Safely reads and parses key manifests from disk with strict bounds.
   */
  private async readManifestsFromDisk(
    workspaceRoot: string,
    filePaths: string[],
  ): Promise<AnalysisInput['manifests']> {
    const manifests: Record<string, any> = {};

    const readFileSafe = async (relativePath: string): Promise<string | null> => {
      try {
        const fullPath = path.join(workspaceRoot, relativePath);
        // Security check: ensure path stays within workspaceRoot
        const resolved = path.resolve(fullPath);
        if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
          return null;
        }

        const stat = await fsp.stat(resolved);
        if (stat.size > this.maxManifestSizeBytes) {
          return null; // Exceeds safe manifest read limit
        }

        return await fsp.readFile(resolved, 'utf-8');
      } catch {
        return null;
      }
    };

    // 1. package.json
    if (filePaths.includes('package.json')) {
      const content = await readFileSafe('package.json');
      if (content) {
        try {
          manifests.packageJson = JSON.parse(content);
        } catch {
          // Non-fatal: malformed package.json
        }
      }
    }

    // 2. Python manifests
    if (filePaths.includes('requirements.txt')) {
      manifests.requirementsTxt = await readFileSafe('requirements.txt');
    }
    if (filePaths.includes('pyproject.toml')) {
      manifests.pyprojectToml = await readFileSafe('pyproject.toml');
    }

    // 3. Java manifests
    if (filePaths.includes('pom.xml')) {
      manifests.pomXml = await readFileSafe('pom.xml');
    }
    if (filePaths.includes('build.gradle')) {
      manifests.buildGradle = await readFileSafe('build.gradle');
    } else if (filePaths.includes('build.gradle.kts')) {
      manifests.buildGradle = await readFileSafe('build.gradle.kts');
    }

    // 4. Go manifests
    if (filePaths.includes('go.mod')) {
      manifests.goMod = await readFileSafe('go.mod');
    }

    return manifests;
  }

  /**
   * Identifies all recognized configuration and manifest files in the repository.
   * Returns a deterministically sorted array capped at 50 entries.
   */
  private findDetectedFiles(filePaths: string[]): string[] {
    const found = new Set<string>();

    for (const p of filePaths) {
      const basename = p.split('/').pop() || p;
      if (
        this.recognizedPatterns.includes(basename) ||
        this.recognizedPatterns.some((pattern) => basename.toLowerCase() === pattern.toLowerCase())
      ) {
        found.add(p);
      }
    }

    // Deterministic alphabetical sort, capped at 50
    return Array.from(found).sort().slice(0, 50);
  }

  /**
   * Detects monorepo structure from workspace manifests and directory signals.
   */
  private detectMonorepo(filePaths: string[], packageJson?: any): boolean {
    // Check dedicated workspace files
    if (
      filePaths.some((p) => {
        const base = p.split('/').pop();
        return (
          base === 'pnpm-workspace.yaml' ||
          base === 'turbo.json' ||
          base === 'nx.json' ||
          base === 'lerna.json'
        );
      })
    ) {
      return true;
    }

    // Check package.json workspaces
    if (packageJson?.workspaces) {
      if (Array.isArray(packageJson.workspaces) && packageJson.workspaces.length > 0) {
        return true;
      }
      if (typeof packageJson.workspaces === 'object' && packageJson.workspaces.packages) {
        return true;
      }
    }

    // Check directory presence with nested packages
    const hasAppsDir = filePaths.some((p) => p.startsWith('apps/') && p.endsWith('/package.json'));
    const hasPackagesDir = filePaths.some(
      (p) => p.startsWith('packages/') && p.endsWith('/package.json'),
    );
    const hasServicesDir = filePaths.some(
      (p) => p.startsWith('services/') && p.endsWith('/package.json'),
    );

    return hasAppsDir || hasPackagesDir || hasServicesDir;
  }

  /**
   * Deterministically detects package manager.
   * Priority:
   *  - JS/TS: pnpm > yarn > npm
   *  - Python: poetry > pip
   *  - Java: maven > gradle
   *  - Go: go
   */
  private detectPackageManager(
    filePaths: string[],
    manifests: AnalysisInput['manifests'],
  ): string | null {
    const fileBasenames = filePaths.map((p) => p.split('/').pop() || p);

    // JavaScript / TypeScript lockfiles
    if (fileBasenames.includes('pnpm-lock.yaml') || fileBasenames.includes('pnpm-workspace.yaml')) {
      return 'pnpm';
    }
    if (fileBasenames.includes('yarn.lock')) {
      return 'yarn';
    }
    if (fileBasenames.includes('package-lock.json')) {
      return 'npm';
    }
    if (fileBasenames.includes('package.json')) {
      return 'npm';
    }

    // Python
    if (
      fileBasenames.includes('poetry.lock') ||
      (manifests?.pyprojectToml && manifests.pyprojectToml.includes('[tool.poetry]'))
    ) {
      return 'poetry';
    }
    if (fileBasenames.includes('Pipfile') || fileBasenames.includes('Pipfile.lock')) {
      return 'pipenv';
    }
    if (fileBasenames.includes('requirements.txt') || fileBasenames.includes('pyproject.toml')) {
      return 'pip';
    }

    // Java
    if (fileBasenames.includes('pom.xml')) {
      return 'maven';
    }
    if (fileBasenames.includes('build.gradle') || fileBasenames.includes('build.gradle.kts')) {
      return 'gradle';
    }

    // Go
    if (fileBasenames.includes('go.mod')) {
      return 'go';
    }

    // Rust
    if (fileBasenames.includes('Cargo.toml')) {
      return 'cargo';
    }

    return null;
  }

  /**
   * Deterministically calculates primary language from source file frequencies with clear tie-breaking.
   */
  private calculatePrimaryLanguage(languageCounts: Map<string, number>): string | null {
    if (languageCounts.size === 0) return null;

    let bestLang: string | null = null;
    let maxCount = -1;

    // Deterministic tie-breaking: highest file count; if equal, alphabetical order
    const sortedEntries = Array.from(languageCounts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // Descending count
      return a[0].localeCompare(b[0]); // Alphabetical tie-breaker
    });

    return sortedEntries.length > 0 ? sortedEntries[0][0] : null;
  }

  /**
   * Detects primary language, framework, and broad project type from workspace evidence.
   */
  private detectTechStackFromWorkspace(
    filePaths: string[],
    manifests: AnalysisInput['manifests'],
    languageCounts: Map<string, number>,
    hasDockerfile: boolean,
  ): { projectType: ProjectType; primaryLanguage: string | null; framework: string | null } {
    const basenames = filePaths.map((p) => p.split('/').pop() || p);

    // 1. JavaScript / TypeScript Detection
    const hasTsConfig = basenames.includes('tsconfig.json');
    const hasPackageJson = basenames.includes('package.json');
    const tsCount = languageCounts.get('TypeScript') || 0;
    const jsCount = languageCounts.get('JavaScript') || 0;

    if (hasPackageJson || hasTsConfig || tsCount > 0 || jsCount > 0) {
      const primaryLanguage = tsCount > 0 || hasTsConfig ? 'TypeScript' : 'JavaScript';
      const pkg = manifests?.packageJson || {};
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
        ...(pkg.peerDependencies || {}),
      };

      let framework: string | null = null;

      // Next.js
      if (allDeps['next'] || basenames.some((b) => b.startsWith('next.config.'))) {
        framework = 'Next.js';
      }
      // NestJS
      else if (allDeps['@nestjs/core'] || basenames.includes('nest-cli.json')) {
        framework = 'NestJS';
      }
      // Angular
      else if (allDeps['@angular/core'] || basenames.includes('angular.json')) {
        framework = 'Angular';
      }
      // Vite
      else if (allDeps['vite'] || basenames.some((b) => b.startsWith('vite.config.'))) {
        framework = 'Vite';
      }
      // React
      else if (allDeps['react']) {
        framework = 'React';
      }
      // Express
      else if (allDeps['express']) {
        framework = 'Express';
      }

      return {
        projectType: 'WEB_APPLICATION',
        primaryLanguage,
        framework,
      };
    }

    // 2. Python Detection
    const hasPyProject = basenames.includes('pyproject.toml');
    const hasRequirements = basenames.includes('requirements.txt');
    const hasPipfile = basenames.includes('Pipfile');
    const pyCount = languageCounts.get('Python') || 0;

    if (hasPyProject || hasRequirements || hasPipfile || pyCount > 0) {
      const pythonContent = (
        (manifests?.requirementsTxt || '') +
        '\n' +
        (manifests?.pyprojectToml || '')
      ).toLowerCase();

      let framework: string | null = null;
      if (pythonContent.includes('fastapi')) {
        framework = 'FastAPI';
      } else if (pythonContent.includes('django') || basenames.includes('manage.py')) {
        framework = 'Django';
      } else if (pythonContent.includes('flask')) {
        framework = 'Flask';
      }

      return {
        projectType: 'PYTHON_APPLICATION',
        primaryLanguage: 'Python',
        framework,
      };
    }

    // 3. Java Detection
    const hasPomXml = basenames.includes('pom.xml');
    const hasBuildGradle =
      basenames.includes('build.gradle') || basenames.includes('build.gradle.kts');
    const javaCount = languageCounts.get('Java') || 0;

    if (hasPomXml || hasBuildGradle || javaCount > 0) {
      const javaContent = (
        (manifests?.pomXml || '') +
        '\n' +
        (manifests?.buildGradle || '')
      ).toLowerCase();

      const framework =
        javaContent.includes('spring-boot') || javaContent.includes('springframework.boot')
          ? 'Spring Boot'
          : null;

      return {
        projectType: 'JAVA_APPLICATION',
        primaryLanguage: 'Java',
        framework,
      };
    }

    // 4. Go Detection
    const hasGoMod = basenames.includes('go.mod');
    const goCount = languageCounts.get('Go') || 0;

    if (hasGoMod || goCount > 0) {
      return {
        projectType: 'GO_APPLICATION',
        primaryLanguage: 'Go',
        framework: 'Go',
      };
    }

    // 5. General Language Fallback from Extension Counts
    const detectedPrimaryLang = this.calculatePrimaryLanguage(languageCounts);
    if (detectedPrimaryLang) {
      return {
        projectType: 'UNKNOWN',
        primaryLanguage: detectedPrimaryLang,
        framework: null,
      };
    }

    // 6. Generic Docker Detection
    if (hasDockerfile) {
      return {
        projectType: 'DOCKER_APPLICATION',
        primaryLanguage: 'Dockerfile',
        framework: null,
      };
    }

    // 7. Unknown
    return {
      projectType: 'UNKNOWN',
      primaryLanguage: null,
      framework: null,
    };
  }
}
