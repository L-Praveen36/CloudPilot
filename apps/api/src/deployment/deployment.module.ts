import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { DeploymentPlanService } from './services/deployment-plan.service';
import { DockerExecutionService } from './services/docker-execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RepositoryIntelligenceModule } from '../repository-intelligence/repository-intelligence.module';
import { CicdModule } from '../cicd/cicd.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    RepositoryIntelligenceModule,
    forwardRef(() => CicdModule),
  ],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    DeploymentPlanService,
    DockerExecutionService,
  ],
  exports: [
    DeploymentService,
    DeploymentPlanService,
    DockerExecutionService,
  ],
})
export class DeploymentModule {}
