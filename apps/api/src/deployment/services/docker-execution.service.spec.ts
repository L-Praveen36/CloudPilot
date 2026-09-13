import { DockerExecutionService } from './docker-execution.service';

describe('DockerExecutionService (Phase 4)', () => {
  let service: DockerExecutionService;

  beforeEach(() => {
    service = new DockerExecutionService();
  });

  describe('1. Log Sanitization', () => {
    it('should redact GitHub personal access tokens from logs', () => {
      const raw = 'Cloning with token ghp_123456789012345678901234567890123456 into repo';
      const sanitized = service.sanitizeLog(raw);

      expect(sanitized).not.toContain('ghp_123456789012345678901234567890123456');
      expect(sanitized).toContain('[REDACTED_GITHUB_TOKEN]');
    });

    it('should redact Bearer authorization headers from logs', () => {
      const raw = 'Request header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      const sanitized = service.sanitizeLog(raw);

      expect(sanitized).not.toContain('eyJhbGci');
      expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');
    });

    it('should redact database passwords from logs', () => {
      const raw = 'Connected to postgres://user:password=secret_db_pass_99@localhost:5432/db';
      const sanitized = service.sanitizeLog(raw);

      expect(sanitized).not.toContain('secret_db_pass_99');
      expect(sanitized).toContain('password=[REDACTED]');
    });

    it('should redact host workspace filesystem paths from logs', () => {
      const raw = 'Created build directory in C:\\Users\\user\\AppData\\Local\\Temp\\cp-src-abc12345';
      const sanitized = service.sanitizeLog(raw);

      expect(sanitized).not.toContain('C:\\Users\\user');
      expect(sanitized).toContain('[REDACTED_PATH]');
    });

    it('should redact OpenAI API keys and environment variables from logs', () => {
      const raw = 'Configured OPENAI_API_KEY=sk-proj-abc12345678901234567890 with key sk-live-99887766554433221100';
      const sanitized = service.sanitizeLog(raw);

      expect(sanitized).not.toContain('sk-proj-abc12345678901234567890');
      expect(sanitized).not.toContain('sk-live-99887766554433221100');
      expect(sanitized).toContain('OPENAI_API_KEY=[REDACTED]');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });

    it('should redact database connection strings from logs', () => {
      const raw = 'Connecting to mysql://root:super_secret_db_pass@127.0.0.1:3306/smart_planner';
      const sanitized = service.sanitizeLog(raw);

      expect(sanitized).not.toContain('super_secret_db_pass');
      expect(sanitized).toContain('mysql://[USER]:[REDACTED]@127.0.0.1:3306/smart_planner');
    });
  });

  describe('2. Dynamic Port Allocation', () => {
    it('should find an available ephemeral port', async () => {
      const port = await service.findAvailablePort(12000, 50);

      expect(typeof port).toBe('number');
      expect(port).toBeGreaterThanOrEqual(12000);
      expect(port).toBeLessThan(12050);
    });
  });

  describe('3. Resource Limits Defaults', () => {
    it('should enforce safe default resource bounds', () => {
      expect(service.maxBuildTimeoutMs).toBe(300000);
      expect(service.maxMemoryMb).toBe(512);
      expect(service.maxCpu).toBe('1.0');
      expect(service.maxLogBytes).toBe(1048576);
    });
  });

  describe('4. Container Diagnostics Collection', () => {
    it('should return null or handle non-existent container gracefully', async () => {
      jest.spyOn(service, 'executeCommand').mockRejectedValue(new Error('No such container'));
      const diag = await service.getContainerDiagnostics('non-existent-container-xyz-123');
      expect(diag).toBeDefined();
    });

    it('should extract OpenAI missing key error and exit state from container output', async () => {
      jest.spyOn(service, 'executeCommand').mockImplementation(async (cmd, args) => {
        if (args[0] === 'inspect') {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              Running: false,
              ExitCode: 1,
              OOMKilled: false,
              StartedAt: '2026-09-12T10:00:00Z',
              FinishedAt: '2026-09-12T10:00:02Z',
              Error: '',
            }),
            stderr: '',
          };
        }
        if (args[0] === 'logs') {
          return {
            exitCode: 0,
            stdout: 'Error: The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option.',
            stderr: '',
          };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });

      const diag = await service.getContainerDiagnostics('test-crashed-container');

      expect(diag).toBeDefined();
      expect(diag?.running).toBe(false);
      expect(diag?.exitCode).toBe(1);
      expect(diag?.oomKilled).toBe(false);
      expect(diag?.sanitizedRuntimeError).toContain('OPENAI_API_KEY environment variable is missing or empty');
    });
  });
});
