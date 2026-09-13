import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../security/crypto.service';
import { DeploymentService } from '../../deployment/deployment.service';

export interface WebhookProcessResult {
  status: 'PROCESSED' | 'IGNORED' | 'DUPLICATE' | 'FAILED';
  deliveryId: string;
  projectId?: string;
  deploymentId?: string;
  reason?: string;
  message?: string;
}

@Injectable()
export class WebhookReceiverService {
  private readonly logger = new Logger(WebhookReceiverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(forwardRef(() => DeploymentService))
    private readonly deploymentService: DeploymentService,
  ) {}

  /**
   * Processes an incoming GitHub webhook with HMAC verification and idempotency.
   */
  async processGitHubWebhook(
    deliveryId: string,
    event: string,
    signatureHeader: string | undefined,
    rawPayload: string | Buffer,
    parsedPayload: any,
  ): Promise<WebhookProcessResult> {
    if (!deliveryId) {
      throw new BadRequestException('Missing X-GitHub-Delivery header');
    }

    // 1. Check idempotency: if delivery already received, return duplicate status
    let existingEvent = await this.prisma.githubWebhookEvent.findUnique({
      where: { deliveryId },
    });

    if (existingEvent) {
      this.logger.log(`Idempotent webhook: delivery ${deliveryId} already recorded (${existingEvent.status}).`);
      return {
        status: 'DUPLICATE',
        deliveryId,
        projectId: existingEvent.projectId,
        deploymentId: existingEvent.deploymentId || undefined,
        message: 'Webhook delivery already received and processed.',
      };
    }

    // 2. Handle Ping event
    if (event === 'ping') {
      return {
        status: 'PROCESSED',
        deliveryId,
        message: 'Ping event received successfully.',
      };
    }

    if (event !== 'push') {
      return {
        status: 'IGNORED',
        deliveryId,
        reason: `Ignored unsupported event type: ${event}`,
      };
    }

    // 3. Resolve Project
    const repoId = parsedPayload?.repository?.id;
    const repoFullName = parsedPayload?.repository?.full_name;

    if (!repoId && !repoFullName) {
      throw new BadRequestException('Malformed webhook payload: missing repository identifier.');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          ...(repoId ? [{ githubRepositoryId: Number(repoId) }] : []),
          ...(repoFullName ? [{ repositoryFullName: String(repoFullName) }] : []),
        ],
      },
    });

    if (!project) {
      throw new NotFoundException(`No CloudPilot project found matching repository '${repoFullName || repoId}'.`);
    }

    // 4. Verify HMAC-SHA256 signature if webhook secret is configured
    if (project.webhookSecret) {
      if (!signatureHeader) {
        throw new BadRequestException('Missing X-Hub-Signature-256 header for secured webhook.');
      }

      let secretPlain: string;
      try {
        secretPlain = this.crypto.decrypt(project.webhookSecret);
      } catch {
        secretPlain = project.webhookSecret;
      }

      const rawString = typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf8');
      const expectedSignature = `sha256=${crypto.createHmac('sha256', secretPlain).update(rawString).digest('hex')}`;

      const isValid = this.crypto.timingSafeEqual(signatureHeader, expectedSignature);
      if (!isValid) {
        this.logger.warn(`Invalid webhook signature for project ${project.id}`);
        throw new BadRequestException('Invalid webhook cryptographic signature.');
      }
    }

    // 5. Parse Commit, Branch & Ref
    const ref = parsedPayload?.ref || ''; // e.g. "refs/heads/main"
    const branch = ref.startsWith('refs/heads/') ? ref.replace('refs/heads/', '') : ref;
    const commitSha = parsedPayload?.after || parsedPayload?.head_commit?.id || null;
    const commitMessage = parsedPayload?.head_commit?.message?.substring(0, 200) || null;
    const sender = parsedPayload?.sender?.login || 'GitHub Webhook';

    // 6. Match Environment by branchPattern
    const environments = await this.prisma.environment.findMany({
      where: { projectId: project.id },
    });

    const matchedEnv = environments.find((env) => this.matchBranchPattern(env.branchPattern, branch));

    if (!matchedEnv) {
      try {
        await this.prisma.githubWebhookEvent.create({
          data: {
            deliveryId,
            projectId: project.id,
            event,
            sender,
            ref,
            commitSha,
            status: 'IGNORED',
            reason: `No environment configured for branch '${branch}'`,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          return {
            status: 'DUPLICATE',
            deliveryId,
            projectId: project.id,
            message: 'Webhook delivery already received and processed.',
          };
        }
        throw err;
      }

      return {
        status: 'IGNORED',
        deliveryId,
        projectId: project.id,
        reason: `No environment configured for branch '${branch}'`,
      };
    }

    // 7. Check if autoDeployEnabled is active on this environment
    if (!matchedEnv.autoDeployEnabled) {
      try {
        await this.prisma.githubWebhookEvent.create({
          data: {
            deliveryId,
            projectId: project.id,
            event,
            sender,
            ref,
            commitSha,
            status: 'IGNORED',
            reason: `Auto-deploy is disabled for environment '${matchedEnv.name}' (branch '${branch}')`,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          return {
            status: 'DUPLICATE',
            deliveryId,
            projectId: project.id,
            message: 'Webhook delivery already received and processed.',
          };
        }
        throw err;
      }

      return {
        status: 'IGNORED',
        deliveryId,
        projectId: project.id,
        reason: `Auto-deploy disabled for environment '${matchedEnv.name}'`,
      };
    }

    // 8. Trigger CI/CD Deployment
    this.logger.log(`Triggering CI/CD deployment for project ${project.id} on environment '${matchedEnv.name}' (commit ${commitSha?.substring(0, 7)})`);

    let webhookEventRecord: any;
    try {
      webhookEventRecord = await this.prisma.githubWebhookEvent.create({
        data: {
          deliveryId,
          projectId: project.id,
          event,
          sender,
          ref,
          commitSha,
          status: 'PROCESSED',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return {
          status: 'DUPLICATE',
          deliveryId,
          projectId: project.id,
          message: 'Webhook delivery already received and processed.',
        };
      }
      throw err;
    }

    try {
      const deploymentDto = await this.deploymentService.deployWithVersion(
        project.userId,
        project.id,
        {
          environmentId: matchedEnv.id,
          commitSha: commitSha || undefined,
          commitMessage: commitMessage || undefined,
          branch,
          triggerType: 'WEBHOOK',
          triggeredBy: `GitHub Push (${sender})`,
        },
      );

      await this.prisma.githubWebhookEvent.update({
        where: { id: webhookEventRecord.id },
        data: { deploymentId: deploymentDto.id },
      });

      return {
        status: 'PROCESSED',
        deliveryId,
        projectId: project.id,
        deploymentId: deploymentDto.id,
        message: `Deployment #${deploymentDto.deploymentNumber || deploymentDto.id.substring(0, 8)} triggered for environment '${matchedEnv.name}'.`,
      };
    } catch (err: any) {
      this.logger.error(`Webhook deployment failed to initialize: ${err.message}`);

      await this.prisma.githubWebhookEvent.update({
        where: { id: webhookEventRecord.id },
        data: {
          status: 'FAILED',
          reason: err.message,
        },
      });

      return {
        status: 'FAILED',
        deliveryId,
        projectId: project.id,
        reason: err.message,
      };
    }
  }

  /**
   * Matches a branch name against a pattern (supports exact, wildcard *, or prefix patterns).
   */
  public matchBranchPattern(pattern: string, branch: string): boolean {
    if (!pattern || !branch) return false;
    const cleanPattern = pattern.trim();
    const cleanBranch = branch.trim();

    if (cleanPattern === '*' || cleanPattern === cleanBranch) {
      return true;
    }

    // Wildcard support: feature/* -> ^feature/.*$
    if (cleanPattern.includes('*')) {
      const regexStr = '^' + cleanPattern.replace(/\*/g, '.*') + '$';
      try {
        const regex = new RegExp(regexStr);
        return regex.test(cleanBranch);
      } catch {
        return false;
      }
    }

    return false;
  }
}
