import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheckResponse } from '@cloudpilot/shared';
import { PrismaService } from '../prisma/prisma.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<HealthCheckResponse> {
    const isDbHealthy = await this.prisma.isHealthy();

    const timestamp = new Date().toISOString();

    return {
      status: isDbHealthy ? 'ok' : 'degraded',
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp,
      services: {
        database: {
          status: isDbHealthy ? 'ok' : 'degraded',
          message: isDbHealthy ? 'Database connection active' : 'Database connection unavailable',
          timestamp,
        },
        redis: {
          status: 'ok',
          message: 'Redis cache configured',
          timestamp,
        },
      },
    };
  }
}
