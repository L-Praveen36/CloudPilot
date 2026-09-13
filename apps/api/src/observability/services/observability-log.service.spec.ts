import { ObservabilityLogService } from './observability-log.service';

describe('ObservabilityLogService', () => {
  let service: ObservabilityLogService;

  beforeEach(() => {
    service = new ObservabilityLogService();
  });

  describe('sanitizeLogMessage', () => {
    it('should strip ANSI color codes', () => {
      const raw = '\u001b[32mSUCCESS:\u001b[0m Application listening on port 8080';
      const clean = service.sanitizeLogMessage(raw);
      expect(clean).toBe('SUCCESS: Application listening on port 8080');
    });

    it('should redact GitHub Personal Access Tokens and OAuth tokens', () => {
      const raw = 'Failed to clone repo with token ghp_1234567890abcdef1234567890abcdef1234';
      const clean = service.sanitizeLogMessage(raw);
      expect(clean).toBe('Failed to clone repo with token [REDACTED_GITHUB_TOKEN]');
    });

    it('should redact Bearer authorization headers', () => {
      const raw = 'Request header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
      const clean = service.sanitizeLogMessage(raw);
      expect(clean).toBe('Request header: Bearer [REDACTED_TOKEN]');
    });

    it('should redact query string secrets', () => {
      const raw = 'Connecting to postgres://user:password=supersecret@localhost:5432/db';
      const clean = service.sanitizeLogMessage(raw);
      expect(clean).toContain('password=[REDACTED]');
      expect(clean).not.toContain('supersecret');
    });
  });

  describe('getTailLogs', () => {
    const mockStoredLogs = [
      { timestamp: '2026-09-05T10:00:00Z', level: 'INFO' as const, message: 'Starting application', stage: 'START' },
      { timestamp: '2026-09-05T10:00:01Z', level: 'WARN' as const, message: 'High memory detected', stage: 'RUN' },
      { timestamp: '2026-09-05T10:00:02Z', level: 'ERROR' as const, message: 'Database connection failed', stage: 'RUN' },
    ];

    it('should return stored logs when container is not running', async () => {
      const result = await service.getTailLogs(null, mockStoredLogs);
      expect(result.lines).toHaveLength(3);
      expect(result.totalLines).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should filter logs by level', async () => {
      const result = await service.getTailLogs(null, mockStoredLogs, { level: 'ERROR' });
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].level).toBe('ERROR');
      expect(result.lines[0].message).toBe('Database connection failed');
    });

    it('should filter logs by search text', async () => {
      const result = await service.getTailLogs(null, mockStoredLogs, { search: 'memory' });
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].message).toContain('memory');
    });

    it('should respect pagination limit', async () => {
      const result = await service.getTailLogs(null, mockStoredLogs, { limit: 2 });
      expect(result.lines).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.lines[1].message).toBe('Database connection failed');
    });
  });
});
