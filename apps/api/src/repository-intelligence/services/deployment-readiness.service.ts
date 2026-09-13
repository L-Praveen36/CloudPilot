import { Injectable, Logger } from '@nestjs/common';
import {
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
  DeploymentReadinessStatus,
  DeploymentStrategy,
  DeploymentBlocker,
  DeploymentWarning,
  DeploymentRequirement,
  DeploymentRecommendation,
  ScoreBreakdown,
  SubApplicationReadiness,
} from '@cloudpilot/shared';

/**
 * Phase 3.4 — Deployment Readiness & Feasibility Service
 *
 * Statically evaluates the combined results of Phase 3.2 (Repository Analyzer)
 * and Phase 3.3 (Application Structure Detection) to determine:
 *  - Deployment feasibility & status (READY, READY_WITH_WARNINGS, BLOCKED, UNKNOWN)
 *  - Deployment strategy (STATIC_FRONTEND, NODE_APPLICATION, PYTHON_APPLICATION, etc.)
 *  - Deterministic score (0-100) and category breakdown
 *  - Blockers, Warnings, Requirements, and Actionable Recommendations
 *  - Monorepo per-sub-application readiness
 *
 * Strict Static Analysis Guarantee:
 *  - Never executes repository code, scripts, package managers, or Docker.
 *  - Pure, deterministic, explainable rule engine.
 */
@Injectable()
export class DeploymentReadinessService {
  private readonly logger = new Logger(DeploymentReadinessService.name);

  /**
   * Main entry point for Phase 3.4 readiness evaluation.
   */
  analyzeReadiness(
    analysis: Partial<RepositoryAnalysisDto>,
    structure: ApplicationStructureDto,
    dockerfileContent?: string | null,
    envExampleContent?: string | null,
  ): DeploymentReadinessDto {
    const blockers: DeploymentBlocker[] = [];
    const warnings: DeploymentWarning[] = [];
    const requirements: DeploymentRequirement[] = [];
    const recommendations: DeploymentRecommendation[] = [];

    // 1. Determine Deployment Strategy
    const strategy = this.determineDeploymentStrategy(analysis, structure, dockerfileContent);

    // 2. Multi-App / Monorepo per-sub-app evaluation
    const subApplicationsReadiness: SubApplicationReadiness[] = [];
    if (structure.applications && structure.applications.length > 1) {
      for (const app of structure.applications) {
        if (app.role === 'LIBRARY') continue; // shared packages are not independent deployments
        const subReadiness = this.evaluateSubApplication(app);
        subApplicationsReadiness.push(subReadiness);
      }
      subApplicationsReadiness.sort((a, b) => a.path.localeCompare(b.path));
    }

    // 3. Category Evaluations & Scoring Breakdown
    const scoreBreakdown: ScoreBreakdown = {
      applicationIdentity: 0,
      buildReadiness: 0,
      runtimeReadiness: 0,
      portReadiness: 0,
      outputArtifactReadiness: 0,
      environmentConfiguration: 0,
      deploymentStrategy: 0,
    };

    // Category 1: Application Identity (Max 15)
    if (structure.primaryRole !== 'UNKNOWN' || strategy === 'DOCKER_APPLICATION') {
      scoreBreakdown.applicationIdentity += 10;
      if (analysis.framework || analysis.primaryLanguage || strategy === 'DOCKER_APPLICATION') {
        scoreBreakdown.applicationIdentity += 5;
      }
    } else {
      blockers.push({
        code: 'UNKNOWN_APPLICATION_ROLE',
        category: 'APPLICATION_IDENTITY',
        message: 'Application role could not be determined with sufficient static evidence.',
        evidence: structure.evidence,
      });
      recommendations.push({
        message: 'Add standard package manifests or application entry points to identify the project.',
        action: 'ADD_MANIFEST',
        priority: 'HIGH',
      });
    }

    // Category 2: Build Readiness (Max 20)
    const requiresBuild =
      structure.primaryRole === 'FRONTEND' ||
      analysis.framework === 'Next.js' ||
      analysis.framework === 'NestJS' ||
      analysis.framework === 'Angular' ||
      analysis.primaryLanguage === 'Java' ||
      analysis.primaryLanguage === 'Go';

    if (structure.topLevelBuildCommand) {
      if (structure.topLevelBuildCommand.isDeclared) {
        scoreBreakdown.buildReadiness = 20;
      } else {
        scoreBreakdown.buildReadiness = 15;
        warnings.push({
          code: 'INFERRED_BUILD_COMMAND',
          category: 'BUILD',
          message: `Build command '${structure.topLevelBuildCommand.command}' was inferred from framework convention rather than declared in manifest.`,
          evidence: [structure.topLevelBuildCommand.source],
        });
        recommendations.push({
          message: `Declare an explicit build script in package.json (e.g. "build": "${structure.topLevelBuildCommand.command}").`,
          action: 'DECLARE_BUILD_SCRIPT',
          priority: 'MEDIUM',
        });
      }
    } else if (!requiresBuild || strategy === 'DOCKER_APPLICATION') {
      // Python direct run, Express without build, Docker build, etc.
      scoreBreakdown.buildReadiness = 20;
    } else {
      scoreBreakdown.buildReadiness = 0;
      blockers.push({
        code: 'MISSING_BUILD_COMMAND',
        category: 'BUILD',
        message: 'Project requires a build step but no declared or inferable build command was found.',
      });
      recommendations.push({
        message: 'Add a build script to package.json or configure build tooling.',
        action: 'ADD_BUILD_SCRIPT',
        priority: 'HIGH',
      });
    }

    // Category 3: Start/Runtime Readiness (Max 20)
    const isWorker = structure.primaryRole === 'WORKER';
    const isLibrary = structure.primaryRole === 'LIBRARY' || structure.primaryRole === 'CLI';
    const hasDockerRuntime =
      strategy === 'DOCKER_APPLICATION' &&
      dockerfileContent &&
      (dockerfileContent.includes('CMD') || dockerfileContent.includes('ENTRYPOINT'));

    if (isLibrary) {
      scoreBreakdown.runtimeReadiness = 5;
      blockers.push({
        code: 'NON_DEPLOYABLE_ROLE',
        category: 'RUNTIME',
        message: `Projects with role ${structure.primaryRole} are not standalone deployable services.`,
      });
      recommendations.push({
        message: 'CloudPilot deploys standalone web applications, APIs, and background workers. Internal libraries and CLI utilities are not supported as standalone deployments.',
        action: 'UNSUPPORTED_ROLE',
        priority: 'HIGH',
      });
    } else if (structure.topLevelStartCommand || hasDockerRuntime) {
      if (structure.topLevelStartCommand?.isDeclared || hasDockerRuntime) {
        scoreBreakdown.runtimeReadiness = 20;
      } else {
        scoreBreakdown.runtimeReadiness = 15;
        warnings.push({
          code: 'INFERRED_START_COMMAND',
          category: 'RUNTIME',
          message: `Start command '${structure.topLevelStartCommand!.command}' was inferred from convention.`,
          evidence: [structure.topLevelStartCommand!.source],
        });
        recommendations.push({
          message: `Define an explicit production start script in project configuration (e.g. "start": "${structure.topLevelStartCommand!.command}").`,
          action: 'DECLARE_START_SCRIPT',
          priority: 'MEDIUM',
        });
      }
    } else if (structure.topLevelEntryPoint) {
      scoreBreakdown.runtimeReadiness = 10;
      warnings.push({
        code: 'START_COMMAND_FROM_ENTRYPOINT',
        category: 'RUNTIME',
        message: `Entrypoint ${structure.topLevelEntryPoint.path} detected without explicit start command.`,
      });
    } else {
      scoreBreakdown.runtimeReadiness = 0;
      blockers.push({
        code: 'MISSING_START_COMMAND',
        category: 'RUNTIME',
        message: 'No deterministic runtime entry point or start command could be established.',
      });
      recommendations.push({
        message: 'Add an explicit start script in package.json (e.g. "start": "node index.js") or configure application entry point.',
        action: 'ADD_START_SCRIPT',
        priority: 'HIGH',
      });
    }

    // Category 4: Port Readiness (Max 15)
    if (isWorker || strategy === 'STATIC_FRONTEND') {
      // Workers & Static Frontends don't need backend listening port
      scoreBreakdown.portReadiness = 15;
    } else if (structure.topLevelPort) {
      if (structure.topLevelPort.confidence === 'HIGH') {
        scoreBreakdown.portReadiness = 15;
      } else {
        scoreBreakdown.portReadiness = 10;
        warnings.push({
          code: 'PORT_DEFAULTED_CONVENTION',
          category: 'PORT',
          message: `Port ${structure.topLevelPort.port} is inferred from ${structure.topLevelPort.source}.`,
        });
        recommendations.push({
          message: `Document the explicit application port in .env.example (e.g. PORT=${structure.topLevelPort.port}).`,
          action: 'DOCUMENT_PORT',
          priority: 'LOW',
        });
      }
    } else {
      scoreBreakdown.portReadiness = 5;
      warnings.push({
        code: 'UNDETERMINED_PORT',
        category: 'PORT',
        message: 'No explicit or conventional port detected for server application.',
      });
      recommendations.push({
        message: 'Specify the listening port in .env.example (e.g. PORT=3000) or Dockerfile EXPOSE.',
        action: 'DOCUMENT_PORT',
        priority: 'MEDIUM',
      });
    }

    // Category 5: Output Artifact Readiness (Max 10)
    if (structure.topLevelOutputDirectory) {
      scoreBreakdown.outputArtifactReadiness = 10;
    } else if (!requiresBuild) {
      scoreBreakdown.outputArtifactReadiness = 10;
    } else {
      scoreBreakdown.outputArtifactReadiness = 5;
      warnings.push({
        code: 'OUTPUT_DIR_CONVENTION',
        category: 'OUTPUT',
        message: 'Build output directory is derived from default convention.',
      });
    }

    // Category 6: Environment Configuration (Max 10)
    if (analysis.hasEnvExample || envExampleContent) {
      scoreBreakdown.environmentConfiguration = 10;
      this.extractEnvRequirements(envExampleContent, requirements);
    } else {
      scoreBreakdown.environmentConfiguration = 5;
      warnings.push({
        code: 'MISSING_ENV_EXAMPLE',
        category: 'ENVIRONMENT',
        message: 'No .env.example file found. Documenting environment variables ensures reproducible deployment configuration.',
      });
      recommendations.push({
        message: 'Create a .env.example file documenting required environment variables (e.g. PORT, DATABASE_URL).',
        action: 'CREATE_ENV_EXAMPLE',
        priority: 'MEDIUM',
      });
    }

    // Merge source-detected environment requirements from structure
    if (structure.detectedEnvironmentVariables && structure.detectedEnvironmentVariables.length > 0) {
      for (const srcReq of structure.detectedEnvironmentVariables) {
        const existingIdx = requirements.findIndex((r) => r.name === srcReq.name);
        if (existingIdx !== -1) {
          // Merge: preserve documented status, take highest requirement/confidence
          requirements[existingIdx].required = requirements[existingIdx].required || srcReq.required;
          requirements[existingIdx].confidence = srcReq.confidence || requirements[existingIdx].confidence || 'HIGH';
        } else {
          requirements.push({
            ...srcReq,
            documented: false,
          });

          if (srcReq.required && srcReq.confidence === 'HIGH') {
            warnings.push({
              code: 'UNDOCUMENTED_REQUIRED_ENV_VAR',
              category: 'ENVIRONMENT',
              message: `Required environment variable '${srcReq.name}' is referenced in source code without fallback, but not documented in .env.example.`,
              evidence: [srcReq.source],
            });
            recommendations.push({
              message: `Document '${srcReq.name}' in .env.example to ensure reproducible deployment environments.`,
              action: 'DOCUMENT_ENV_VAR',
              priority: 'HIGH',
            });
          }
        }
      }
    }

    // Category 7: Deployment Strategy (Max 10)
    if (strategy !== 'UNSUPPORTED' && strategy !== 'UNKNOWN') {
      scoreBreakdown.deploymentStrategy = 10;
    } else {
      scoreBreakdown.deploymentStrategy = 0;
    }

    // Frontend-Backend Relationship Validation
    if (strategy === 'STATIC_FRONTEND' || structure.primaryRole === 'FRONTEND') {
      const hasBackendRel = structure.relationships.some(
        (r) => r.relationshipType === 'CLIENT_SERVER' || r.relationshipType === 'PROXY',
      );
      if (hasBackendRel) {
        recommendations.push({
          message: 'Frontend interacts with backend services. Verify API base URL configuration in production environment.',
          action: 'VERIFY_API_URL',
          priority: 'MEDIUM',
        });
      }
    }

    // Calculate Final Total Score
    const score = Math.max(
      0,
      Math.min(
        100,
        scoreBreakdown.applicationIdentity +
          scoreBreakdown.buildReadiness +
          scoreBreakdown.runtimeReadiness +
          scoreBreakdown.portReadiness +
          scoreBreakdown.outputArtifactReadiness +
          scoreBreakdown.environmentConfiguration +
          scoreBreakdown.deploymentStrategy,
      ),
    );

    // Determine Final Readiness Status
    let status: DeploymentReadinessStatus = 'UNKNOWN';
    if (blockers.length > 0 || strategy === 'UNSUPPORTED') {
      status = 'BLOCKED';
    } else if (score >= 90 && warnings.length === 0) {
      status = 'READY';
    } else if (score >= 70) {
      status = 'READY_WITH_WARNINGS';
    } else {
      status = 'BLOCKED';
    }

    // Build Summary Message
    const summary = this.generateSummary(status, strategy, score, blockers.length, warnings.length);

    // Deterministic Sorting of All Arrays
    blockers.sort((a, b) => a.code.localeCompare(b.code));
    warnings.sort((a, b) => a.code.localeCompare(b.code));
    requirements.sort((a, b) => a.name.localeCompare(b.name));
    recommendations.sort((a, b) => {
      const pOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
      const diff = (pOrder[a.priority] || 4) - (pOrder[b.priority] || 4);
      return diff !== 0 ? diff : a.message.localeCompare(b.message);
    });

    return {
      status,
      score,
      strategy,
      summary,
      blockers,
      warnings,
      requirements,
      recommendations,
      scoreBreakdown,
      subApplicationsReadiness: subApplicationsReadiness.length > 0 ? subApplicationsReadiness : undefined,
    };
  }

  /**
   * Deterministically resolves the recommended DeploymentStrategy.
   */
  private determineDeploymentStrategy(
    analysis: Partial<RepositoryAnalysisDto>,
    structure: ApplicationStructureDto,
    dockerfileContent?: string | null,
  ): DeploymentStrategy {
    // 1. Unsupported roles (LIBRARY, CLI)
    if (structure.primaryRole === 'LIBRARY' || structure.primaryRole === 'CLI') {
      return 'UNSUPPORTED';
    }

    // 2. Multi-Application in Monorepo
    if (structure.applications && structure.applications.length > 1) {
      const deployableApps = structure.applications.filter((a) => a.role !== 'LIBRARY');
      if (deployableApps.length > 1) {
        return 'MULTI_APPLICATION';
      }
    }

    // 3. Explicit Dockerfile with sufficient configuration
    if (analysis.hasDockerfile || dockerfileContent) {
      if (
        dockerfileContent?.includes('FROM') &&
        (dockerfileContent?.includes('CMD') || dockerfileContent?.includes('ENTRYPOINT'))
      ) {
        return 'DOCKER_APPLICATION';
      }
    }

    // 4. Static Frontend
    if (
      structure.primaryRole === 'FRONTEND' &&
      (analysis.framework === 'Vite' || analysis.framework === 'React' || analysis.framework === 'Angular')
    ) {
      return 'STATIC_FRONTEND';
    }

    // 5. Node.js Application (Next.js, NestJS, Express, etc.)
    if (
      structure.primaryRole === 'FULLSTACK' ||
      analysis.framework === 'Next.js' ||
      analysis.framework === 'NestJS' ||
      analysis.framework === 'Express' ||
      analysis.primaryLanguage === 'TypeScript' ||
      analysis.primaryLanguage === 'JavaScript'
    ) {
      return 'NODE_APPLICATION';
    }

    // 6. Python Application
    if (
      analysis.projectType === 'PYTHON_APPLICATION' ||
      analysis.primaryLanguage === 'Python' ||
      analysis.framework === 'FastAPI' ||
      analysis.framework === 'Django' ||
      analysis.framework === 'Flask'
    ) {
      return 'PYTHON_APPLICATION';
    }

    // 7. Java Application
    if (
      analysis.projectType === 'JAVA_APPLICATION' ||
      analysis.primaryLanguage === 'Java' ||
      analysis.framework === 'Spring Boot'
    ) {
      return 'JAVA_APPLICATION';
    }

    // 8. Go Application
    if (analysis.projectType === 'GO_APPLICATION' || analysis.primaryLanguage === 'Go') {
      return 'GO_APPLICATION';
    }

    // 9. Docker Application fallback if Dockerfile is present
    if (analysis.hasDockerfile) {
      return 'DOCKER_APPLICATION';
    }

    return 'UNKNOWN';
  }

  /**
   * Evaluates readiness for an individual sub-application in a monorepo.
   */
  private evaluateSubApplication(app: any): SubApplicationReadiness {
    let strategy: DeploymentStrategy = 'NODE_APPLICATION';
    if (app.role === 'FRONTEND') {
      strategy = 'STATIC_FRONTEND';
    } else if (app.language === 'Python') {
      strategy = 'PYTHON_APPLICATION';
    } else if (app.language === 'Java') {
      strategy = 'JAVA_APPLICATION';
    } else if (app.language === 'Go') {
      strategy = 'GO_APPLICATION';
    }

    let subScore = 50;
    if (app.entryPoint) subScore += 20;
    if (app.buildCommand || app.role !== 'FRONTEND') subScore += 15;
    if (app.startCommand || app.role === 'FRONTEND') subScore += 15;

    let subStatus: DeploymentReadinessStatus = 'READY';
    if (subScore < 70) {
      subStatus = 'BLOCKED';
    } else if (subScore < 90) {
      subStatus = 'READY_WITH_WARNINGS';
    }

    return {
      name: app.name,
      path: app.path,
      strategy,
      status: subStatus,
      score: subScore,
    };
  }

  /**
   * Standard runtime / infrastructure environment variables that commonly appear in
   * .env.example with default values (e.g. PORT=5000, HOST=0.0.0.0, NODE_ENV=production)
   * or are automatically managed by container runtimes/strategies.
   * These should NOT be classified as mandatory deployment blockers.
   */
  private static readonly STANDARD_RUNTIME_ENV_VARS = new Set<string>([
    'PORT',
    'HOST',
    'HOSTNAME',
    'NODE_ENV',
  ]);

  /**
   * Extracts required environment variable metadata from .env.example.
   * Standard runtime variables with safe defaults (PORT, HOST, NODE_ENV) are
   * classified as documented but optional (required: false).
   */
  private extractEnvRequirements(
    envExample: string | null | undefined,
    requirements: DeploymentRequirement[],
  ): void {
    if (!envExample) return;

    const lines = envExample.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex !== -1) {
        const varName = trimmed.substring(0, eqIndex).trim();
        if (varName && /^[A-Z0-9_]+$/.test(varName)) {
          const isStandardRuntime = DeploymentReadinessService.STANDARD_RUNTIME_ENV_VARS.has(varName);
          requirements.push({
            name: varName,
            required: !varName.includes('OPTIONAL') && !isStandardRuntime,
            documented: true,
            source: '.env.example',
            confidence: 'HIGH',
          });
        }
      }
    }
  }

  /**
   * Generates a concise human-readable summary.
   */
  private generateSummary(
    status: DeploymentReadinessStatus,
    strategy: DeploymentStrategy,
    score: number,
    blockerCount: number,
    warningCount: number,
  ): string {
    if (status === 'READY') {
      return `Repository is fully ready for deployment using ${strategy} strategy (Readiness score: ${score}/100).`;
    }
    if (status === 'READY_WITH_WARNINGS') {
      return `Repository is deployable using ${strategy} strategy with ${warningCount} non-blocking warning(s) (Readiness score: ${score}/100).`;
    }
    if (status === 'BLOCKED') {
      return `Deployment is blocked by ${blockerCount} issue(s) (Readiness score: ${score}/100).`;
    }
    return `Deployment feasibility could not be determined (Score: ${score}/100).`;
  }
}
