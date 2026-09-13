import { ObservabilityHealthService } from './observability-health.service';

describe('ObservabilityHealthService', () => {
  let service: ObservabilityHealthService;

  beforeEach(() => {
    service = new ObservabilityHealthService();
  });

  describe('probeHealth', () => {
    it('should return UNKNOWN when neither hostPort nor containerName is provided', async () => {
      const result = await service.probeHealth(null, 'NONE');
      expect(result.status).toBe('UNKNOWN');
      expect(result.latencyMs).toBe(0);
    });

    it('should return UNHEALTHY when HTTP connection cannot be established', async () => {
      // Probing an unlikely port to trigger connection error
      const result = await service.probeHealth(59999, 'HTTP', '/health');
      expect(result.status).toBe('UNHEALTHY');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
