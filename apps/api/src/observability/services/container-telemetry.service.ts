import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ContainerMetricsSnapshot,
  MetricHistoryPoint,
  DeploymentEventDto,
} from '@cloudpilot/shared';

@Injectable()
export class ContainerTelemetryService {
  private readonly logger = new Logger(ContainerTelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Safely collects a live resource metrics snapshot for a container.
   */
  async collectContainerMetrics(
    deploymentId: string,
    containerName: string,
  ): Promise<ContainerMetricsSnapshot | null> {
    if (!containerName) return null;

    try {
      // 1. Inspect container state & uptime
      const inspectData = await this.inspectContainer(containerName);
      if (!inspectData) {
        return null;
      }

      let containerStatus: ContainerMetricsSnapshot['containerStatus'] = 'UNKNOWN';
      if (inspectData.State?.Running) containerStatus = 'RUNNING';
      else if (inspectData.State?.Paused) containerStatus = 'PAUSED';
      else if (inspectData.State?.Restarting) containerStatus = 'RESTARTING';
      else if (inspectData.State?.Dead) containerStatus = 'DEAD';
      else containerStatus = 'EXITED';

      let uptimeSeconds = 0;
      if (inspectData.State?.StartedAt && inspectData.State?.Running) {
        const started = new Date(inspectData.State.StartedAt).getTime();
        uptimeSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
      }

      // Check for OOM kill or abnormal exit
      if (inspectData.State?.OOMKilled) {
        await this.recordEvent(
          deploymentId,
          'CONTAINER_OOM',
          'CRITICAL',
          `Container ${containerName} was killed due to Out-Of-Memory (OOM).`,
          { exitCode: inspectData.State.ExitCode },
        );
      } else if (!inspectData.State?.Running && inspectData.State?.ExitCode !== 0 && inspectData.State?.ExitCode !== undefined) {
        await this.recordEvent(
          deploymentId,
          'CONTAINER_EXIT',
          'CRITICAL',
          `Container ${containerName} exited unexpectedly with code ${inspectData.State.ExitCode}.`,
          { exitCode: inspectData.State.ExitCode },
        );
      }

      // If container is not running, return stopped snapshot without stats
      if (!inspectData.State?.Running) {
        return {
          cpuPercent: 0,
          memoryUsageBytes: 0,
          memoryLimitBytes: 0,
          memoryPercent: 0,
          networkInputBytes: 0,
          networkOutputBytes: 0,
          blockInputBytes: 0,
          blockOutputBytes: 0,
          pids: 0,
          containerStatus,
          uptimeSeconds: 0,
          timestamp: new Date().toISOString(),
        };
      }

      // 2. Query docker stats
      const stats = await this.queryDockerStats(containerName);
      const snapshot: ContainerMetricsSnapshot = {
        cpuPercent: stats ? stats.cpuPercent : 0,
        memoryUsageBytes: stats ? stats.memoryUsageBytes : 0,
        memoryLimitBytes: stats ? stats.memoryLimitBytes : 0,
        memoryPercent: stats ? stats.memoryPercent : 0,
        networkInputBytes: stats ? stats.networkInputBytes : 0,
        networkOutputBytes: stats ? stats.networkOutputBytes : 0,
        blockInputBytes: stats ? stats.blockInputBytes : 0,
        blockOutputBytes: stats ? stats.blockOutputBytes : 0,
        pids: stats ? stats.pids : 1,
        containerStatus: 'RUNNING',
        uptimeSeconds,
        timestamp: new Date().toISOString(),
      };

      // 3. Evaluate threshold alerts
      if (snapshot.cpuPercent >= 85) {
        await this.recordEvent(
          deploymentId,
          'HIGH_CPU_USAGE',
          snapshot.cpuPercent >= 95 ? 'CRITICAL' : 'WARNING',
          `High CPU utilization detected: ${snapshot.cpuPercent.toFixed(1)}%`,
          { cpuPercent: snapshot.cpuPercent },
        );
      }

      if (snapshot.memoryPercent >= 85) {
        await this.recordEvent(
          deploymentId,
          'HIGH_MEMORY_USAGE',
          snapshot.memoryPercent >= 95 ? 'CRITICAL' : 'WARNING',
          `High Memory utilization detected: ${snapshot.memoryPercent.toFixed(1)}% (${(snapshot.memoryUsageBytes / (1024 * 1024)).toFixed(1)} MB)`,
          { memoryPercent: snapshot.memoryPercent, usageBytes: snapshot.memoryUsageBytes },
        );
      }

      // 4. Persist snapshot to database
      await this.prisma.deploymentMetric.create({
        data: {
          deploymentId,
          cpuPercent: snapshot.cpuPercent,
          memoryUsageBytes: snapshot.memoryUsageBytes,
          memoryLimitBytes: snapshot.memoryLimitBytes,
          memoryPercent: snapshot.memoryPercent,
          networkInputBytes: snapshot.networkInputBytes,
          networkOutputBytes: snapshot.networkOutputBytes,
          blockInputBytes: snapshot.blockInputBytes,
          blockOutputBytes: snapshot.blockOutputBytes,
          pids: snapshot.pids,
        },
      });

      return snapshot;
    } catch (err: any) {
      this.logger.warn(`Failed to collect container metrics for ${containerName}: ${err.message}`);
      return null;
    }
  }

  /**
   * Retrieves historical metrics for graphing (ordered chronologically).
   */
  async getMetricsHistory(
    deploymentId: string,
    limit = 60,
  ): Promise<MetricHistoryPoint[]> {
    const metrics = await this.prisma.deploymentMetric.findMany({
      where: { deploymentId },
      orderBy: { timestamp: 'desc' },
      take: Math.min(Math.max(1, limit), 500),
    });

    return metrics.reverse().map((m) => ({
      timestamp: m.timestamp.toISOString(),
      cpuPercent: m.cpuPercent,
      memoryPercent: m.memoryPercent,
      memoryUsageBytes: m.memoryUsageBytes,
      networkInputBytes: m.networkInputBytes,
      networkOutputBytes: m.networkOutputBytes,
      pids: m.pids,
    }));
  }

  /**
   * Records an operational or incident event in database.
   */
  async recordEvent(
    deploymentId: string,
    type: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    message: string,
    metadata?: Record<string, any>,
  ): Promise<DeploymentEventDto> {
    // Avoid duplicate threshold events within a 60-second window
    if (type === 'HIGH_CPU_USAGE' || type === 'HIGH_MEMORY_USAGE') {
      const recent = await this.prisma.deploymentEvent.findFirst({
        where: {
          deploymentId,
          type,
          timestamp: { gte: new Date(Date.now() - 60000) },
        },
      });
      if (recent) {
        return {
          id: recent.id,
          deploymentId: recent.deploymentId,
          type: recent.type,
          severity: recent.severity as any,
          message: recent.message,
          metadata: recent.metadata as any,
          timestamp: recent.timestamp.toISOString(),
        };
      }
    }

    const created = await this.prisma.deploymentEvent.create({
      data: {
        deploymentId,
        type,
        severity,
        message,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    return {
      id: created.id,
      deploymentId: created.deploymentId,
      type: created.type,
      severity: created.severity as any,
      message: created.message,
      metadata: created.metadata as any,
      timestamp: created.timestamp.toISOString(),
    };
  }

  /**
   * Retrieves events associated with a deployment.
   */
  async getDeploymentEvents(deploymentId: string, limit = 50): Promise<DeploymentEventDto[]> {
    const events = await this.prisma.deploymentEvent.findMany({
      where: { deploymentId },
      orderBy: { timestamp: 'desc' },
      take: Math.min(Math.max(1, limit), 200),
    });

    return events.map((e) => ({
      id: e.id,
      deploymentId: e.deploymentId,
      type: e.type,
      severity: e.severity as any,
      message: e.message,
      metadata: e.metadata as any,
      timestamp: e.timestamp.toISOString(),
    }));
  }

  /**
   * Executes docker inspect via safe spawn.
   */
  private async inspectContainer(containerName: string): Promise<any | null> {
    try {
      const result = await this.executeCommand('docker', ['inspect', containerName], 5000);
      if (result.exitCode === 0 && result.stdout.trim()) {
        const parsed = JSON.parse(result.stdout);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Queries docker stats --no-stream --format "{{json .}}".
   */
  private async queryDockerStats(containerName: string): Promise<{
    cpuPercent: number;
    memoryUsageBytes: number;
    memoryLimitBytes: number;
    memoryPercent: number;
    networkInputBytes: number;
    networkOutputBytes: number;
    blockInputBytes: number;
    blockOutputBytes: number;
    pids: number;
  } | null> {
    try {
      const result = await this.executeCommand(
        'docker',
        ['stats', '--no-stream', '--format', '{{json .}}', containerName],
        6000,
      );

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return null;
      }

      const raw = JSON.parse(result.stdout.trim());

      // Parse CPU percentage
      const cpuPercent = parseFloat((raw.CPUPerc || '0%').replace('%', '')) || 0;

      // Parse Memory usage and limit (e.g. "12.5MiB / 512MiB" or "100MB / 1GB")
      const [memUsedStr, memLimitStr] = (raw.MemUsage || '0B / 0B').split(' / ');
      const memoryUsageBytes = this.parseHumanBytes(memUsedStr);
      const memoryLimitBytes = this.parseHumanBytes(memLimitStr);
      const memoryPercent = parseFloat((raw.MemPerc || '0%').replace('%', '')) ||
        (memoryLimitBytes > 0 ? (memoryUsageBytes / memoryLimitBytes) * 100 : 0);

      // Parse Network I/O (e.g. "1.2kB / 500B")
      const [netInStr, netOutStr] = (raw.NetIO || '0B / 0B').split(' / ');
      const networkInputBytes = this.parseHumanBytes(netInStr);
      const networkOutputBytes = this.parseHumanBytes(netOutStr);

      // Parse Block I/O (e.g. "0B / 0B")
      const [blockInStr, blockOutStr] = (raw.BlockIO || '0B / 0B').split(' / ');
      const blockInputBytes = this.parseHumanBytes(blockInStr);
      const blockOutputBytes = this.parseHumanBytes(blockOutStr);

      // Parse PIDs
      const pids = parseInt(raw.PIDs || '1', 10) || 1;

      return {
        cpuPercent: Math.max(0, cpuPercent),
        memoryUsageBytes,
        memoryLimitBytes,
        memoryPercent: Math.max(0, memoryPercent),
        networkInputBytes,
        networkOutputBytes,
        blockInputBytes,
        blockOutputBytes,
        pids,
      };
    } catch (err: any) {
      this.logger.debug(`Could not parse docker stats for ${containerName}: ${err.message}`);
      return null;
    }
  }

  /**
   * Helper to parse human-readable byte strings (e.g. "12.5MiB", "1.2GB", "500kB", "100B").
   */
  public parseHumanBytes(str: string): number {
    if (!str || typeof str !== 'string') return 0;
    const clean = str.trim().toUpperCase();
    const match = clean.match(/^([\d.]+)\s*([A-Z]*)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'B': return value;
      case 'KB':
      case 'KIB': return value * 1024;
      case 'MB':
      case 'MIB': return value * 1024 * 1024;
      case 'GB':
      case 'GIB': return value * 1024 * 1024 * 1024;
      case 'TB':
      case 'TIB': return value * 1024 * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  /**
   * Spawns a process safely with no shell.
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
