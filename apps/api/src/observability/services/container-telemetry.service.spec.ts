import { ContainerTelemetryService } from './container-telemetry.service';

describe('ContainerTelemetryService', () => {
  let service: ContainerTelemetryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      deploymentMetric: {
        create: jest.fn().mockResolvedValue({ id: 'metric-1' }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'metric-1',
            deploymentId: 'dep-1',
            cpuPercent: 12.5,
            memoryPercent: 30.0,
            memoryUsageBytes: 30000000,
            memoryLimitBytes: 100000000,
            networkInputBytes: 5000,
            networkOutputBytes: 10000,
            blockInputBytes: 0,
            blockOutputBytes: 0,
            pids: 4,
            timestamp: new Date('2026-09-05T10:00:00Z'),
          },
        ]),
      },
      deploymentEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'event-1',
          ...data,
          timestamp: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new ContainerTelemetryService(mockPrisma);
  });

  describe('parseHumanBytes', () => {
    it('should parse bytes correctly', () => {
      expect(service.parseHumanBytes('500B')).toBe(500);
      expect(service.parseHumanBytes('1.5KB')).toBe(1.5 * 1024);
      expect(service.parseHumanBytes('10MiB')).toBe(10 * 1024 * 1024);
      expect(service.parseHumanBytes('1.2GB')).toBe(1.2 * 1024 * 1024 * 1024);
    });

    it('should return 0 for empty or invalid input', () => {
      expect(service.parseHumanBytes('')).toBe(0);
      expect(service.parseHumanBytes('invalid')).toBe(0);
    });
  });

  describe('getMetricsHistory', () => {
    it('should return mapped metric points ordered chronologically', async () => {
      const history = await service.getMetricsHistory('dep-1', 10);
      expect(history).toHaveLength(1);
      expect(history[0].cpuPercent).toBe(12.5);
      expect(history[0].pids).toBe(4);
      expect(mockPrisma.deploymentMetric.findMany).toHaveBeenCalledWith({
        where: { deploymentId: 'dep-1' },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
    });
  });

  describe('recordEvent', () => {
    it('should create and return a DeploymentEventDto', async () => {
      const event = await service.recordEvent('dep-1', 'STATUS_CHANGE', 'INFO', 'Deployment status changed to RUNNING');
      expect(event.type).toBe('STATUS_CHANGE');
      expect(event.severity).toBe('INFO');
      expect(event.message).toContain('RUNNING');
      expect(mockPrisma.deploymentEvent.create).toHaveBeenCalled();
    });

    it('should deduplicate threshold events within window', async () => {
      mockPrisma.deploymentEvent.findFirst.mockResolvedValueOnce({
        id: 'existing-event',
        deploymentId: 'dep-1',
        type: 'HIGH_CPU_USAGE',
        severity: 'WARNING',
        message: 'High CPU',
        metadata: null,
        timestamp: new Date(),
      });

      const event = await service.recordEvent('dep-1', 'HIGH_CPU_USAGE', 'WARNING', 'High CPU 90%');
      expect(event.id).toBe('existing-event');
      expect(mockPrisma.deploymentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('collectContainerMetrics', () => {
    it('should return null when containerName is empty', async () => {
      const result = await service.collectContainerMetrics('dep-1', '');
      expect(result).toBeNull();
    });
  });
});
