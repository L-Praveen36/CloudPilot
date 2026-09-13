import { Test, TestingModule } from '@nestjs/testing';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';
import { AuthGuard } from '../auth/guards/auth.guard';

describe('ObservabilityController', () => {
  let controller: ObservabilityController;
  let mockObservabilityService: any;

  beforeEach(async () => {
    mockObservabilityService = {
      getDeploymentTelemetry: jest.fn().mockResolvedValue({
        deploymentId: 'dep-1',
        projectId: 'proj-1',
        status: 'RUNNING',
        healthStatus: 'HEALTHY',
      }),
      getDeploymentMetrics: jest.fn().mockResolvedValue({
        deploymentId: 'dep-1',
        current: null,
        history: [],
      }),
      collectMetricsNow: jest.fn().mockResolvedValue({
        deploymentId: 'dep-1',
        current: null,
        history: [],
      }),
      getTailLogs: jest.fn().mockResolvedValue({
        deploymentId: 'dep-1',
        lines: [],
        totalLines: 0,
        hasMore: false,
      }),
      getDeploymentEvents: jest.fn().mockResolvedValue({
        deploymentId: 'dep-1',
        events: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ObservabilityController],
      providers: [
        { provide: ObservabilityService, useValue: mockObservabilityService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ObservabilityController>(ObservabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get telemetry', async () => {
    const req = { user: { id: 'user-1' } };
    const res = await controller.getTelemetry(req, 'proj-1', 'dep-1');
    expect(res.telemetry.deploymentId).toBe('dep-1');
    expect(mockObservabilityService.getDeploymentTelemetry).toHaveBeenCalledWith('user-1', 'proj-1', 'dep-1');
  });

  it('should get metrics', async () => {
    const req = { user: { id: 'user-1' } };
    const res = await controller.getMetrics(req, 'proj-1', 'dep-1', '30');
    expect(res.deploymentId).toBe('dep-1');
    expect(mockObservabilityService.getDeploymentMetrics).toHaveBeenCalledWith('user-1', 'proj-1', 'dep-1', 30);
  });

  it('should collect metrics on demand', async () => {
    const req = { user: { id: 'user-1' } };
    const res = await controller.collectMetrics(req, 'proj-1', 'dep-1');
    expect(res.deploymentId).toBe('dep-1');
    expect(mockObservabilityService.collectMetricsNow).toHaveBeenCalledWith('user-1', 'proj-1', 'dep-1');
  });

  it('should get tail logs', async () => {
    const req = { user: { id: 'user-1' } };
    const res = await controller.getTailLogs(req, 'proj-1', 'dep-1', 'ERROR', 'fail', '50');
    expect(res.deploymentId).toBe('dep-1');
    expect(mockObservabilityService.getTailLogs).toHaveBeenCalledWith('user-1', 'proj-1', 'dep-1', {
      level: 'ERROR',
      search: 'fail',
      limit: 50,
      since: undefined,
    });
  });

  it('should get events', async () => {
    const req = { user: { id: 'user-1' } };
    const res = await controller.getEvents(req, 'proj-1', 'dep-1', '20');
    expect(res.deploymentId).toBe('dep-1');
    expect(mockObservabilityService.getDeploymentEvents).toHaveBeenCalledWith('user-1', 'proj-1', 'dep-1', 20);
  });
});
