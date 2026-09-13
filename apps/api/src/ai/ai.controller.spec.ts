import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthGuard } from '../auth/guards/auth.guard';

describe('AiController', () => {
  let controller: AiController;

  const mockAiService = {
    getRepositoryUnderstanding: jest.fn().mockResolvedValue({ summary: 'AI Repo Understanding' }),
    getDeploymentProposal: jest.fn().mockResolvedValue({ strategy: 'NODE_NEXTJS' }),
    diagnoseBuildFailure: jest.fn().mockResolvedValue({ problem: 'Build error' }),
    diagnoseIncident: jest.fn().mockResolvedValue({ problem: 'Incident error' }),
    getRepairSuggestions: jest.fn().mockResolvedValue([{ title: 'Suggestion 1' }]),
    approveRepairSuggestion: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
    rejectRepairSuggestion: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
    runAgent: jest.fn().mockResolvedValue({ answer: 'Agent response' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AiController>(AiController);
  });

  it('should return repository understanding', async () => {
    const req = { user: { id: 'user-123' } };
    const res = await controller.getRepositoryUnderstanding(req, 'proj-123');
    expect(res.understanding).toBeDefined();
    expect(mockAiService.getRepositoryUnderstanding).toHaveBeenCalledWith('user-123', 'proj-123');
  });

  it('should run AI agent endpoint', async () => {
    const req = { user: { id: 'user-123' } };
    const res = await controller.runAgent(req, 'proj-123', { prompt: 'What happened?' });
    expect(res.answer).toBe('Agent response');
    expect(mockAiService.runAgent).toHaveBeenCalledWith('user-123', 'proj-123', { prompt: 'What happened?' });
  });
});
