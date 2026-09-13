import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './github/github-oauth.service';
import { GitHubApiService } from './github/github-api.service';
import { AuthGuard } from './guards/auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GitHubOAuthService, GitHubApiService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
