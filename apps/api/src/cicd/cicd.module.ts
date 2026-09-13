import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SecurityModule } from '../security/security.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { CicdController } from './cicd.controller';
import { WebhookController } from './controllers/webhook.controller';
import { CicdService } from './cicd.service';
import { EnvironmentService } from './services/environment.service';
import { WebhookReceiverService } from './services/webhook-receiver.service';
import { RollbackService } from './services/rollback.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    SecurityModule,
    forwardRef(() => DeploymentModule),
  ],
  controllers: [CicdController, WebhookController],
  providers: [
    CicdService,
    EnvironmentService,
    WebhookReceiverService,
    RollbackService,
  ],
  exports: [
    CicdService,
    EnvironmentService,
    WebhookReceiverService,
    RollbackService,
  ],
})
export class CicdModule {}
