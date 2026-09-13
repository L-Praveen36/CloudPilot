import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { DeploymentLogEntry, DeploymentLogsQuery, TailLogsResponse } from '@cloudpilot/shared';

@Injectable()
export class ObservabilityLogService {
  private readonly logger = new Logger(ObservabilityLogService.name);

  // Maximum characters allowed per log query to prevent buffer exhaustion
  private readonly maxLogLines = 1000;

  /**
   * Retrieves tailing logs with search filtering and secret redaction.
   */
  async getTailLogs(
    containerName: string | null,
    storedLogs: DeploymentLogEntry[] | null,
    query: DeploymentLogsQuery = {},
  ): Promise<TailLogsResponse> {
    const limit = Math.min(Math.max(1, query.limit || 100), this.maxLogLines);
    let rawEntries: DeploymentLogEntry[] = [];

    // 1. If container is running, fetch live logs from docker
    if (containerName) {
      try {
        const liveEntries = await this.fetchDockerLogs(containerName, limit * 2, query.since);
        if (liveEntries.length > 0) {
          rawEntries = liveEntries;
        }
      } catch (err: any) {
        this.logger.debug(`Could not fetch live docker logs for ${containerName}: ${err.message}`);
      }
    }

    // 2. Fallback to stored logs if no live logs were fetched
    if (rawEntries.length === 0 && Array.isArray(storedLogs)) {
      rawEntries = storedLogs;
    }

    // 3. Filter by log level
    let filtered = rawEntries;
    if (query.level && query.level !== 'ALL') {
      filtered = filtered.filter((entry) => entry.level === query.level);
    }

    // 4. Filter by search term
    if (query.search && query.search.trim()) {
      const term = query.search.trim().toLowerCase();
      filtered = filtered.filter((entry) =>
        entry.message.toLowerCase().includes(term) ||
        (entry.stage && entry.stage.toLowerCase().includes(term)),
      );
    }

    // 5. Sanitize messages
    const sanitized = filtered.map((entry) => ({
      timestamp: entry.timestamp,
      level: entry.level,
      message: this.sanitizeLogMessage(entry.message),
      stage: entry.stage,
    }));

    // 6. Slice to requested limit (most recent entries)
    const resultLines = sanitized.slice(-limit);

    return {
      deploymentId: '', // Populated by caller
      lines: resultLines,
      totalLines: filtered.length,
      hasMore: filtered.length > limit,
    };
  }

  /**
   * Fetches raw logs directly from container using docker logs.
   */
  private async fetchDockerLogs(
    containerName: string,
    tailCount: number,
    since?: string,
  ): Promise<DeploymentLogEntry[]> {
    const args = ['logs', '--tail', String(tailCount), '--timestamps'];
    if (since) {
      args.push('--since', since);
    }
    args.push(containerName);

    const result = await this.executeCommand('docker', args, 6000);
    const combinedOutput = (result.stdout || '') + '\n' + (result.stderr || '');
    const lines = combinedOutput.split('\n').filter((l) => l.trim());

    const entries: DeploymentLogEntry[] = [];
    for (const rawLine of lines) {
      const entry = this.parseDockerLogLine(rawLine);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Parses a timestamped docker log line into a DeploymentLogEntry.
   * e.g. "2026-09-05T10:41:55.123456789Z [INFO] Server started on port 8080"
   */
  private parseDockerLogLine(rawLine: string): DeploymentLogEntry | null {
    if (!rawLine.trim()) return null;

    // ISO timestamp regex at start of line
    const isoMatch = rawLine.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s+(.*)$/);
    let timestamp = new Date().toISOString();
    let message = rawLine;

    if (isoMatch) {
      timestamp = new Date(isoMatch[1]).toISOString();
      message = isoMatch[2];
    }

    // Determine level
    let level: 'INFO' | 'WARN' | 'ERROR' = 'INFO';
    const upper = message.toUpperCase();
    if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('EXCEPTION') || upper.includes('FAIL')) {
      level = 'ERROR';
    } else if (upper.includes('WARN')) {
      level = 'WARN';
    }

    return {
      timestamp,
      level,
      message,
      stage: 'CONTAINER',
    };
  }

  /**
   * Redacts sensitive tokens and strips ANSI color codes.
   */
  public sanitizeLogMessage(message: string): string {
    if (!message) return '';

    return message
      // Strip ANSI escape sequences
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
      // Redact GitHub Personal Access Tokens & OAuth tokens
      .replace(/gh[pousr]_[A-Za-z0-9_]{16,255}/g, '[REDACTED_GITHUB_TOKEN]')
      // Redact Bearer tokens
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]')
      // Redact secrets in query params or headers
      .replace(/(client_secret|access_token|secret|password|api_key)=([^\s&]+)/gi, '$1=[REDACTED]')
      .trim();
  }

  /**
   * Safe spawn execution without shell.
   */
  private executeCommand(
    command: string,
    args: string[],
    timeoutMs = 5000,
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isDone = false;

      const child = spawn(command, args, {
        shell: false,
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          child.kill('SIGKILL');
          resolve({ exitCode: -1, stdout, stderr: 'Command timed out' });
        }
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          resolve({ exitCode: code, stdout, stderr });
        }
      });

      child.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          resolve({ exitCode: -1, stdout, stderr: err.message });
        }
      });
    });
  }
}
