import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  AiCompletionOptions,
  AiCompletionResult,
  AiMessage,
} from './ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  private readonly logger = new Logger(MockAiProvider.name);
  public readonly name = 'cloudpilot-heuristic-engine';
  public readonly modelIdentifier = 'cloudpilot-mock-v1';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async complete(
    prompt: string,
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    const startTime = Date.now();

    // Check if test timeout requested
    if (prompt.includes('TRIGGER_TIMEOUT_ERROR')) {
      throw new Error('AI Provider timeout after 15000ms');
    }

    if (prompt.includes('TRIGGER_MALFORMED_JSON')) {
      return {
        text: '{ "malformed": true, broken',
        model: this.modelIdentifier,
        durationMs: Date.now() - startTime,
      };
    }

    let resultText = '';

    if (options?.responseFormat === 'json') {
      resultText = this.generateStructuredResponse(prompt);
    } else {
      resultText = `CloudPilot Intelligence Analysis based on deterministic facts.\n\nContext evaluation complete.`;
    }

    return {
      text: resultText,
      model: this.modelIdentifier,
      tokensUsed: {
        prompt: Math.ceil(prompt.length / 4),
        completion: Math.ceil(resultText.length / 4),
        total: Math.ceil((prompt.length + resultText.length) / 4),
      },
      durationMs: Date.now() - startTime,
    };
  }

  async chat(
    messages: AiMessage[],
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    return this.complete(lastUserMessage, options);
  }

  private generateStructuredResponse(prompt: string): string {
    // 1. Repository Understanding Request
    if (prompt.includes('REPOSITORY_UNDERSTANDING') || prompt.includes('Technology Stack:')) {
      return JSON.stringify({
        summary: 'Application detected as modern web application with standard containerization capabilities.',
        technology: {
          primaryLanguage: prompt.includes('TypeScript') ? 'TypeScript' : 'JavaScript',
          framework: prompt.includes('Next.js') ? 'Next.js' : prompt.includes('Express') ? 'Express' : 'Node.js',
          packageManager: prompt.includes('pnpm') ? 'pnpm' : prompt.includes('yarn') ? 'yarn' : 'npm',
          projectType: prompt.includes('MONOREPO') ? 'MONOREPO' : 'STANDALONE',
        },
        architecture: {
          role: prompt.includes('Next.js') ? 'FULL_STACK' : 'BACKEND',
          components: [
            {
              name: 'primary-app',
              path: '.',
              role: prompt.includes('Next.js') ? 'FULL_STACK' : 'BACKEND',
              description: 'Primary application service',
            },
          ],
          isMonorepo: prompt.includes('isMonorepo: true'),
        },
        buildAndRun: {
          buildSystem: 'Node.js Package Manager',
          recommendedBuildCommand: prompt.includes('build') ? 'npm run build' : 'npm run build',
          recommendedStartCommand: prompt.includes('start') ? 'npm start' : 'npm run start',
          outputDirectory: '.next',
        },
        deployment: {
          expectedRuntime: 'Node.js 20 Alpine',
          expectedPort: 3000,
          healthCheckPath: '/',
        },
        potentialRisks: [
          {
            category: 'CONFIGURATION',
            severity: 'LOW',
            description: 'Ensure required production environment variables are configured before deployment.',
          },
        ],
        confidence: 'HIGH',
        evidenceSummary: [
          'Deterministic manifest analysis confirms dependencies and scripts.',
          'Application structure detected valid start command and listening port.',
        ],
      });
    }

    // 2. Deployment Proposal Request
    if (prompt.includes('DEPLOYMENT_PROPOSAL') || prompt.includes('Generate Deployment Configuration')) {
      return JSON.stringify({
        strategy: 'NODE_NEXTJS',
        suggestedDockerfile: `FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nENV PORT=3000\nCOPY --from=builder /app ./ \nEXPOSE 3000\nCMD ["npm", "start"]`,
        dockerfileExplanation: 'Multi-stage production build minimizing final image size and running as non-root user.',
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        exposedPort: 3000,
        healthCheckPath: '/',
        healthCheckStrategy: 'HTTP',
        requiredEnvVars: ['PORT', 'NODE_ENV'],
        confidence: 'HIGH',
      });
    }

    // 3. Build Diagnosis Request
    if (prompt.includes('BUILD_DIAGNOSIS') || prompt.includes('Docker build exited with code')) {
      const isMissingDep = prompt.includes('Cannot find module') || prompt.includes('module-not-found');
      const isSyntaxErr = prompt.includes('SyntaxError') || prompt.includes('Unexpected token');

      return JSON.stringify({
        category: 'BUILD',
        problem: isMissingDep
          ? 'Missing required module/dependency during compilation.'
          : isSyntaxErr
          ? 'Syntax error detected in build assets.'
          : 'Docker image build failed during compilation step.',
        likelyCause: isMissingDep
          ? 'Dependency was imported in source files but missing in package.json manifest.'
          : 'Build step encountered an unhandled compilation or script error.',
        affectedComponent: 'Build Step',
        evidence: [
          {
            type: 'FACT',
            source: 'LOGS',
            content: 'Build process terminated with non-zero exit code.',
          },
          {
            type: 'INFERENCE',
            source: 'MANIFEST',
            content: 'Package dependencies may need reconciliation with imported symbols.',
          },
        ],
        recommendation: isMissingDep
          ? 'Add missing package to dependencies in package.json and run build again.'
          : 'Review build logs for exact file and line number and verify build script.',
        confidence: 'HIGH',
        confidenceRationale: 'Direct match between compiler exit status and build log diagnostics.',
      });
    }

    // 4. Incident Diagnosis Request
    if (prompt.includes('INCIDENT_DIAGNOSIS') || prompt.includes('CONTAINER_OOM') || prompt.includes('CONTAINER_EXIT') || prompt.includes('UNHEALTHY')) {
      const isOom = prompt.includes('OOM') || prompt.includes('CONTAINER_OOM');
      const isHealth = prompt.includes('Health probe') || prompt.includes('500');

      return JSON.stringify({
        category: 'INCIDENT',
        problem: isOom
          ? 'Container killed by Linux kernel due to Out-Of-Memory (OOM).'
          : isHealth
          ? 'Application health check failed / returning HTTP 500 server error.'
          : 'Container exited unexpectedly post-startup.',
        likelyCause: isOom
          ? 'Memory consumption exceeded the container boundary limit (512MB).'
          : isHealth
          ? 'Application initialization failure, likely due to missing database connection or unhandled rejection.'
          : 'Process exited with non-zero status code.',
        affectedComponent: 'Container Runtime',
        evidence: [
          {
            type: 'FACT',
            source: isOom ? 'EVENT' : isHealth ? 'TELEMETRY' : 'LOGS',
            content: isOom
              ? 'Docker kernel signaled OOMKilled.'
              : isHealth
              ? 'HTTP health probe returned status >= 500 or timed out.'
              : 'Container exited with non-zero code.',
          },
          {
            type: 'INFERENCE',
            source: 'METRICS',
            content: isOom
              ? 'Memory usage spiked to 100% prior to termination.'
              : 'Service is listening but responding with internal server errors.',
          },
        ],
        recommendation: isOom
          ? 'Increase container memory limit or optimize memory footprint/caching.'
          : 'Check application logs for unhandled exceptions or missing database credentials.',
        confidence: 'HIGH',
        confidenceRationale: 'Correlated telemetry events with container inspect data.',
      });
    }

    // 5. Repair Suggestion Request
    if (prompt.includes('REPAIR_SUGGESTIONS') || prompt.includes('Generate Repair Suggestion')) {
      return JSON.stringify({
        title: 'Configure missing environment variables and increase memory allocation',
        problem: 'Application failed to initialize database connection and health check failed.',
        proposedChange: {
          type: 'ENVIRONMENT_VARIABLE',
          target: '.env',
          content: 'DATABASE_URL="postgresql://user:pass@localhost:5432/db"',
          diffPreview: '+ DATABASE_URL="postgresql://user:pass@localhost:5432/db"',
        },
        reasoning: 'Providing required database configuration will allow server initialization to pass health probes.',
        risk: 'LOW',
        requiresHumanApproval: true,
        evidence: [
          {
            type: 'FACT',
            source: 'LOGS',
            content: 'ConnectionRefusedError: DATABASE_URL not set in environment.',
          },
        ],
        confidence: 'HIGH',
        validationRequirements: [
          'Verify connection string format.',
          'Execute deterministic deployment plan dry-run.',
        ],
      });
    }

    // Default fallback structured response
    return JSON.stringify({
      summary: 'Analysis completed successfully with high confidence.',
      confidence: 'HIGH',
      evidenceSummary: ['Deterministic analysis data evaluated.'],
    });
  }
}
