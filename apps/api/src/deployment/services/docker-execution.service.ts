import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as net from 'net';
import * as http from 'http';
import { DeploymentLogEntry } from '@cloudpilot/shared';

export interface BuildImageOptions {
  workspacePath: string;
  imageTag: string;
  dockerfileName?: string;
  onLog?: (entry: DeploymentLogEntry) => void;
  signal?: AbortSignal;
}

export interface RunContainerOptions {
  imageTag: string;
  containerName: string;
  hostPort: number;
  containerPort: number;
  envVars?: Record<string, string>;
  onLog?: (entry: DeploymentLogEntry) => void;
  signal?: AbortSignal;
}

export interface ContainerDiagnostics {
  containerName: string;
  running: boolean;
  exitCode: number | null;
  oomKilled: boolean;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  logs: string;
  sanitizedRuntimeError?: string;
}

@Injectable()
export class DockerExecutionService {
  private readonly logger = new Logger(DockerExecutionService.name);

  // Configurable Resource Limits & Timeouts
  public readonly maxBuildTimeoutMs: number;
  public readonly maxRuntimeMs: number;
  public readonly maxMemoryMb: number;
  public readonly maxCpu: string;
  public readonly maxLogBytes: number;

  constructor(private readonly configService?: ConfigService) {
    this.maxBuildTimeoutMs = this.configService?.get<number>('MAX_BUILD_TIMEOUT_MS', 300000) ?? 300000;
    this.maxRuntimeMs = this.configService?.get<number>('MAX_RUNTIME_MS', 3600000) ?? 3600000;
    this.maxMemoryMb = this.configService?.get<number>('MAX_MEMORY_MB', 512) ?? 512;
    this.maxCpu = this.configService?.get<string>('MAX_CPU', '1.0') ?? '1.0';
    this.maxLogBytes = this.configService?.get<number>('MAX_LOG_BYTES', 1048576) ?? 1048576;
  }

  /**
   * Checks if Docker daemon is accessible.
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand('docker', ['version', '--format', '{{.Server.Version}}'], {
        timeoutMs: 5000,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Builds a Docker image inside an isolated temporary workspace.
   * NEVER uses shell execution. Uses safe argument arrays.
   */
  async buildImage(options: BuildImageOptions): Promise<{ success: boolean; durationMs: number; error?: string }> {
    const startTime = Date.now();
    const dockerfile = options.dockerfileName || 'Dockerfile';

    const args = ['build', '-t', options.imageTag, '-f', dockerfile, '.'];

    this.logger.log(`Executing Docker build: docker ${args.join(' ')} in ${options.workspacePath}`);

    try {
      const result = await this.executeCommand('docker', args, {
        cwd: options.workspacePath,
        timeoutMs: this.maxBuildTimeoutMs,
        signal: options.signal,
        onStdout: (data) => {
          this.emitLog(options.onLog, 'INFO', data, 'BUILD');
        },
        onStderr: (data) => {
          this.emitLog(options.onLog, 'WARN', data, 'BUILD');
        },
      });

      const durationMs = Date.now() - startTime;

      if (result.exitCode !== 0) {
        const errorMsg = result.stderr || result.stdout || `Docker build exited with code ${result.exitCode}`;
        this.emitLog(options.onLog, 'ERROR', `Build failed: ${this.sanitizeLog(errorMsg)}`, 'BUILD');
        return { success: false, durationMs, error: errorMsg };
      }

      this.emitLog(options.onLog, 'INFO', `Docker image ${options.imageTag} built successfully in ${durationMs}ms`, 'BUILD');
      return { success: true, durationMs };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err.message || 'Build process failed or timed out';
      this.emitLog(options.onLog, 'ERROR', `Build execution error: ${this.sanitizeLog(errorMsg)}`, 'BUILD');
      return { success: false, durationMs, error: errorMsg };
    }
  }

  /**
   * Runs a container with strict security controls and resource boundaries.
   * Strictly binds to 127.0.0.1 (local only).
   */
  async runContainer(options: RunContainerOptions): Promise<{ success: boolean; error?: string }> {
    const args: string[] = [
      'run',
      '-d',
      '--name',
      options.containerName,
      `-p`,
      `127.0.0.1:${options.hostPort}:${options.containerPort}`,
      `--memory=${this.maxMemoryMb}m`,
      `--cpus=${this.maxCpu}`,
      '--security-opt=no-new-privileges',
      '--pids-limit=100',
    ];

    // Pass safe env vars if provided
    if (options.envVars) {
      for (const [k, v] of Object.entries(options.envVars)) {
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) {
          args.push('-e', `${k}=${v}`);
        }
      }
    }

    args.push(options.imageTag);

    this.logger.log(`Executing Docker run: docker run --name ${options.containerName} -p 127.0.0.1:${options.hostPort}:${options.containerPort} ${options.imageTag}`);

    try {
      const result = await this.executeCommand('docker', args, {
        timeoutMs: 30000,
        signal: options.signal,
        onStdout: (data) => {
          this.emitLog(options.onLog, 'INFO', `Container started: ${data.trim()}`, 'RUN');
        },
        onStderr: (data) => {
          this.emitLog(options.onLog, 'WARN', data, 'RUN');
        },
      });

      if (result.exitCode !== 0) {
        const errorMsg = result.stderr || result.stdout || `Docker run exited with code ${result.exitCode}`;
        this.emitLog(options.onLog, 'ERROR', `Container start failed: ${this.sanitizeLog(errorMsg)}`, 'RUN');
        return { success: false, error: errorMsg };
      }

      this.emitLog(options.onLog, 'INFO', `Container ${options.containerName} running on port ${options.hostPort}`, 'RUN');
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Container start failed';
      this.emitLog(options.onLog, 'ERROR', `Container start error: ${this.sanitizeLog(errorMsg)}`, 'RUN');
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Checks HTTP health by probing the local mapped port.
   */
  async checkHttpHealth(
    hostPort: number,
    path = '/',
    timeoutMs = 30000,
    intervalMs = 1500,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const startTime = Date.now();
    const probePath = path.startsWith('/') ? path : `/${path}`;

    while (Date.now() - startTime < timeoutMs) {
      if (signal?.aborted) return false;

      try {
        const isHealthy = await new Promise<boolean>((resolve) => {
          const req = http.get(
            {
              host: '127.0.0.1',
              port: hostPort,
              path: probePath,
              timeout: 2000,
            },
            (res) => {
              // 2xx, 3xx, or even 404/401 means the web server is up and listening
              if (res.statusCode && res.statusCode < 500) {
                resolve(true);
              } else {
                resolve(false);
              }
              res.resume();
            },
          );

          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });

        if (isHealthy) return true;
      } catch {}

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return false;
  }

  /**
   * Checks if container is in running state.
   */
  async isContainerRunning(containerName: string): Promise<boolean> {
    try {
      const result = await this.executeCommand('docker', ['inspect', '-f', '{{.State.Running}}', containerName], {
        timeoutMs: 5000,
      });
      return result.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Stops and forcefully removes a container.
   */
  async stopAndRemoveContainer(containerName: string): Promise<void> {
    try {
      await this.executeCommand('docker', ['rm', '-f', containerName], { timeoutMs: 15000 });
      this.logger.log(`Container ${containerName} stopped and removed.`);
    } catch (err) {
      this.logger.warn(`Could not remove container ${containerName}: ${err}`);
    }
  }

  /**
   * Removes a Docker image by tag.
   */
  async removeImage(imageTag: string): Promise<void> {
    try {
      await this.executeCommand('docker', ['rmi', '-f', imageTag], { timeoutMs: 15000 });
      this.logger.log(`Image ${imageTag} removed.`);
    } catch (err) {
      this.logger.warn(`Could not remove image ${imageTag}: ${err}`);
    }
  }

  /**
   * Finds an available local host port dynamically.
   */
  async findAvailablePort(startPort = 10000, maxAttempts = 100): Promise<number> {
    for (let port = startPort; port < startPort + maxAttempts; port++) {
      const isAvailable = await new Promise<boolean>((resolve) => {
        const server = net.createServer();
        server.unref();
        server.on('error', () => resolve(false));
        server.listen(port, '127.0.0.1', () => {
          server.close(() => resolve(true));
        });
      });

      if (isAvailable) {
        return port;
      }
    }
    throw new Error(`Could not find an available port in range ${startPort}-${startPort + maxAttempts}`);
  }

  /**
   * Spawns a process with explicit argument arrays (NO shell: true).
   */
  public executeCommand(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      timeoutMs?: number;
      signal?: AbortSignal;
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
    } = {},
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const child = spawn(command, args, {
        cwd: options.cwd,
        shell: false, // Critical security control: Never use shell
        windowsHide: true,
      });

      let timeoutTimer: NodeJS.Timeout | null = null;
      if (options.timeoutMs) {
        timeoutTimer = setTimeout(() => {
          isTimedOut = true;
          child.kill('SIGKILL');
          reject(new Error(`Command timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs);
      }

      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          child.kill('SIGKILL');
          if (timeoutTimer) clearTimeout(timeoutTimer);
          reject(new Error('Command aborted by signal'));
        });
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        const str = chunk.toString();
        stdout += str;
        options.onStdout?.(str);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const str = chunk.toString();
        stderr += str;
        options.onStderr?.(str);
      });

      child.on('error', (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        reject(err);
      });

      child.on('close', (code) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (!isTimedOut) {
          resolve({ exitCode: code, stdout, stderr });
        }
      });
    });
  }

  /**
   * Emits a sanitized log entry to the callback.
   */
  private emitLog(
    onLog: ((entry: DeploymentLogEntry) => void) | undefined,
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    stage?: string,
  ): void {
    if (!onLog) return;
    const lines = message.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        onLog({
          timestamp: new Date().toISOString(),
          level,
          message: this.sanitizeLog(trimmed),
          stage,
        });
      }
    }
  }

  /**
   * Collects diagnostic information and logs from a running or exited container before cleanup.
   */
  async getContainerDiagnostics(containerName: string): Promise<ContainerDiagnostics | null> {
    try {
      // 1. Inspect container state
      let running = false;
      let exitCode: number | null = null;
      let oomKilled = false;
      let startedAt: string | undefined;
      let finishedAt: string | undefined;
      let error: string | undefined;

      try {
        const inspectResult = await this.executeCommand('docker', [
          'inspect',
          '--format',
          '{{json .State}}',
          containerName,
        ], { timeoutMs: 5000 });

        if (inspectResult.exitCode === 0 && inspectResult.stdout.trim()) {
          const state = JSON.parse(inspectResult.stdout.trim());
          running = Boolean(state.Running);
          exitCode = typeof state.ExitCode === 'number' ? state.ExitCode : null;
          oomKilled = Boolean(state.OOMKilled);
          startedAt = state.StartedAt;
          finishedAt = state.FinishedAt;
          error = state.Error || undefined;
        }
      } catch (err: any) {
        this.logger.warn(`Could not inspect container ${containerName}: ${err.message}`);
      }

      // 2. Fetch container logs
      let logs = '';
      try {
        const logsResult = await this.executeCommand('docker', [
          'logs',
          '--tail',
          '200',
          containerName,
        ], { timeoutMs: 5000 });

        const rawLogs = (logsResult.stdout || '') + (logsResult.stderr ? `\n${logsResult.stderr}` : '');
        logs = this.sanitizeLog(rawLogs.trim());
      } catch (err: any) {
        this.logger.warn(`Could not fetch logs for container ${containerName}: ${err.message}`);
      }

      // 3. Extract key runtime error if present in logs
      let sanitizedRuntimeError: string | undefined;
      if (logs) {
        if (logs.includes('OPENAI_API_KEY') && (logs.includes('missing or empty') || logs.includes('missing'))) {
          sanitizedRuntimeError = 'The OPENAI_API_KEY environment variable is missing or empty.';
        } else if (logs.includes('ECONNREFUSED')) {
          sanitizedRuntimeError = 'Connection refused by application process or database dependency.';
        } else if (error) {
          sanitizedRuntimeError = this.sanitizeLog(error);
        } else {
          const errorLine = logs.split('\n').find((l) => l.includes('Error:') || l.includes('Exception:'));
          if (errorLine) {
            sanitizedRuntimeError = errorLine.trim();
          }
        }
      }

      return {
        containerName,
        running,
        exitCode,
        oomKilled,
        startedAt,
        finishedAt,
        error,
        logs,
        sanitizedRuntimeError,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to collect diagnostics for ${containerName}: ${err.message}`);
      return null;
    }
  }

  /**
   * Redacts tokens, passwords, private keys, host workspace paths, and strips ANSI escape sequences.
   */
  public sanitizeLog(input: string): string {
    if (!input) return '';
    return input
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/github_pat_[a-zA-Z0-9_]{22,}/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/sk-[a-zA-Z0-9_\-]{20,}/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
      .replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, 'Basic [REDACTED_TOKEN]')
      .replace(/(OPENAI_API_KEY|ANTHROPIC_API_KEY|API_KEY|TOKEN|SECRET)\s*=\s*['"]?[^'"\s\n\r]+['"]?/gi, '$1=[REDACTED]')
      .replace(/password\s*=\s*['"]?[^'"]+['"]?/gi, 'password=[REDACTED]')
      .replace(/secret\s*=\s*['"]?[^'"]+['"]?/gi, 'secret=[REDACTED]')
      .replace(/(mysql|postgres|mongodb|redis):\/\/[^:\s]+:[^@\s]+@/gi, '$1://[USER]:[REDACTED]@')
      .replace(/(\/tmp\/|\\temp\\|cp-src-)[a-zA-Z0-9_\-\\\/]+/g, '[REDACTED_PATH]')
      .replace(/[a-zA-Z]:\\[^\s\n\r"']+/g, '[REDACTED_PATH]');
  }
}
