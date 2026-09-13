import { Module } from '@nestjs/common';
import { GitHubRepositoryController } from './github-repository.controller';
import { GitHubRepositoryService } from './github-repository.service';
import { AuthModule } from '../auth/auth.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [AuthModule, SecurityModule],
  controllers: [GitHubRepositoryController],
  providers: [GitHubRepositoryService],
  exports: [GitHubRepositoryService],
})
export class GitHubModule {}
