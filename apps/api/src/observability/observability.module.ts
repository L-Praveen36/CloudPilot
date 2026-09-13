import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { AuthModule } from '../auth/auth.module';
import { ContainerTelemetryService } from './services/container-telemetry.service';
import { ObservabilityLogService } from './services/observability-log.service';
import { ObservabilityHealthService } from './services/observability-health.service';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';

@Module({
  imports: [PrismaModule, SecurityModule, AuthModule],
  controllers: [ObservabilityController],
  providers: [
    ContainerTelemetryService,
    ObservabilityLogService,
    ObservabilityHealthService,
    ObservabilityService,
  ],
  exports: [
    ContainerTelemetryService,
    ObservabilityLogService,
    ObservabilityHealthService,
    ObservabilityService,
  ],
})
export class ObservabilityModule {}
