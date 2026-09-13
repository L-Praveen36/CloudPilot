import { NotFoundException } from '@nestjs/common';
import { ObservabilityService } from './observability.service';

describe('ObservabilityService', () => {
  let service: ObservabilityService;
  let mockPrisma: any;
  let mockTelemetryService: any;
  let mockLogService: any;
  let mockHealthService: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'proj-1' && where.userId === 'user-1') {
            return Promise.resolve({ id: 'proj-1', userId: 'user-1' });
          }
          return Promise.resolve(null);
        }),
      },
      deployment: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'dep-1' && where.projectId === 'proj-1' && where.userId === 'user-1') {
            return Promise.resolve({
              id: 'dep-1',
              projectId: 'proj-1',
              userId: 'user-1',
              status: 'RUNNING',
              healthStatus: 'HEALTHY',
              containerName: 'cp-app-dep-1',
              hostPort: 11000,
              url: 'http://localhost:11000',
              startedAt: new Date('2026-09-05T10:00:00Z'),
              logs: [],
              plan: { healthCheckStrategy: 'HTTP', healthCheckPath: '/' },
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockTelemetryService = {
      collectContainerMetrics: jest.fn().mockResolvedValue({
        cpuPercent: 5.2,
        memoryUsageBytes: 45000000,
        memoryLimitBytes: 512000000,
        memoryPercent: 8.8,
        networkInputBytes: 1200,
        networkOutputBytes: 3400,
        blockInputBytes: 0,
        blockOutputBytes: 0,
        pids: 3,
        containerStatus: 'RUNNING',
        uptimeSeconds: 120,
        timestamp: new Date().toISOString(),
      }),
      getMetricsHistory: jest.fn().mockResolvedValue([]),
      getDeploymentEvents: jest.fn().mockResolvedValue([]),
    };

    mockLogService = {
      getTailLogs: jest.fn().mockResolvedValue({
        deploymentId: 'dep-1',
        lines: [{ timestamp: '2026-09-05T10:00:00Z', level: 'INFO', message: 'Hello' }],
        totalLines: 1,
        hasMore: false,
      }),
    };

    mockHealthService = {
      probeHealth: jest.fn().mockResolvedValue({
        status: 'HEALTHY',
        latencyMs: 12,
        statusCode: 200,
        timestamp: new Date().toISOString(),
      }),
    };

    service = new ObservabilityService(
      mockPrisma,
      mockTelemetryService,
      mockLogService,
      mockHealthService,
    );
  });

  describe('getDeploymentTelemetry', () => {
    it('should return consolidated telemetry for authorized user', async () => {
      const result = await service.getDeploymentTelemetry('user-1', 'proj-1', 'dep-1');
      expect(result.deploymentId).toBe('dep-1');
      expect(result.status).toBe('RUNNING');
      expect(result.healthStatus).toBe('HEALTHY');
      expect(result.liveSnapshot).toBeDefined();
      expect(result.liveSnapshot?.cpuPercent).toBe(5.2);
      expect(mockHealthService.probeHealth).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unauthorized user or unowned project', async () => {
      await expect(service.getDeploymentTelemetry('user-2', 'proj-1', 'dep-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getDeploymentMetrics', () => {
    it('should return current snapshot and historical series', async () => {
      const result = await service.getDeploymentMetrics('user-1', 'proj-1', 'dep-1', 50);
      expect(result.deploymentId).toBe('dep-1');
      expect(result.current).toBeDefined();
      expect(mockTelemetryService.getMetricsHistory).toHaveBeenCalledWith('dep-1', 50);
    });
  });

  describe('getTailLogs', () => {
    it('should return tailing logs for deployment', async () => {
      const result = await service.getTailLogs('user-1', 'proj-1', 'dep-1', { level: 'INFO' });
      expect(result.deploymentId).toBe('dep-1');
      expect(result.lines).toHaveLength(1);
      expect(mockLogService.getTailLogs).toHaveBeenCalled();
    });
  });

  describe('getDeploymentEvents', () => {
    it('should return events for authorized deployment', async () => {
      const result = await service.getDeploymentEvents('user-1', 'proj-1', 'dep-1');
      expect(result.deploymentId).toBe('dep-1');
      expect(result.events).toEqual([]);
      expect(mockTelemetryService.getDeploymentEvents).toHaveBeenCalledWith('dep-1', 50);
    });
  });
});
