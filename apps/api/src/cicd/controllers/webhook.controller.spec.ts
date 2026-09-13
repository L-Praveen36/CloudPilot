import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookReceiverService } from '../services/webhook-receiver.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: Partial<WebhookReceiverService>;

  beforeEach(async () => {
    webhookService = {
      processGitHubWebhook: jest.fn().mockResolvedValue({
        status: 'PROCESSED',
        matchedEnvironmentId: 'env-prod',
        deploymentId: 'dep-123',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookReceiverService,
          useValue: webhookService,
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should forward webhook payload and headers to WebhookReceiverService', async () => {
    const payload = {
      ref: 'refs/heads/main',
      after: 'abc1234',
      repository: { full_name: 'test-org/test-repo' },
      sender: { login: 'octocat' },
    };
    const req = { rawBody: JSON.stringify(payload) };

    const result = await controller.handleGitHubWebhook(
      'deliv-1',
      'push',
      'sha256=abcdef123456',
      payload,
      req,
    );

    expect(result.status).toBe('PROCESSED');
    expect(result.deploymentId).toBe('dep-123');
    expect(webhookService.processGitHubWebhook).toHaveBeenCalledWith(
      'deliv-1',
      'push',
      'sha256=abcdef123456',
      req.rawBody,
      payload,
    );
  });
});
