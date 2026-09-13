import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import { spawn } from 'child_process';
import { DeploymentHealthStatus } from '@cloudpilot/shared';

export interface HealthProbeResult {
  status: DeploymentHealthStatus;
  latencyMs: number;
  statusCode?: number;
  errorMessage?: string;
  timestamp: string;
}

@Injectable()
export class ObservabilityHealthService {
  private readonly logger = new Logger(ObservabilityHealthService.name);

  /**
   * Actively probes the health of a deployed container.
   */
  async probeHealth(
    hostPort: number | null,
    healthStrategy: string,
    healthPath = '/',
    containerName?: string | null,
  ): Promise<HealthProbeResult> {
    const timestamp = new Date().toISOString();

    // 1. If HTTP strategy with hostPort
    if (healthStrategy === 'HTTP' && hostPort) {
      return this.probeHttpHealth(hostPort, healthPath);
    }

    // 2. If PROCESS strategy with containerName
    if (containerName) {
      return this.probeProcessHealth(containerName);
    }

    return {
      status: 'UNKNOWN',
      latencyMs: 0,
      timestamp,
    };
  }

  /**
   * HTTP probe with latency measurement.
   */
  private async probeHttpHealth(hostPort: number, healthPath: string): Promise<HealthProbeResult> {
    const startTime = Date.now();
    const probePath = healthPath.startsWith('/') ? healthPath : `/${healthPath}`;

    return new Promise<HealthProbeResult>((resolve) => {
      const req = http.get(
        {
          host: '127.0.0.1',
          port: hostPort,
          path: probePath,
          timeout: 4000,
        },
        (res) => {
          const latencyMs = Date.now() - startTime;
          const statusCode = res.statusCode || 0;

          // 2xx or 3xx or 404/401 is considered alive
          let status: DeploymentHealthStatus = 'HEALTHY';
          if (statusCode >= 500) {
            status = 'UNHEALTHY';
          } else if (latencyMs > 1500) {
            status = 'HEALTHY'; // slow but responding
          }

          res.resume();
          resolve({
            status,
            latencyMs,
            statusCode,
            timestamp: new Date().toISOString(),
          });
        },
      );

      req.on('error', (err) => {
        const latencyMs = Date.now() - startTime;
        resolve({
          status: 'UNHEALTHY',
          latencyMs,
          errorMessage: err.message,
          timestamp: new Date().toISOString(),
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'UNHEALTHY',
          latencyMs: 4000,
          errorMessage: 'Health probe timed out (4000ms)',
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  /**
   * Process liveness check using docker inspect.
   */
  private async probeProcessHealth(containerName: string): Promise<HealthProbeResult> {
    const startTime = Date.now();
    try {
      const result = await this.executeCommand('docker', ['inspect', '-f', '{{.State.Running}}', containerName], 4000);
      const latencyMs = Date.now() - startTime;
      const isRunning = result.stdout.trim() === 'true';

      return {
        status: isRunning ? 'HEALTHY' : 'UNHEALTHY',
        latencyMs,
        errorMessage: isRunning ? undefined : 'Container process is not running',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        status: 'UNHEALTHY',
        latencyMs: Date.now() - startTime,
        errorMessage: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

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
