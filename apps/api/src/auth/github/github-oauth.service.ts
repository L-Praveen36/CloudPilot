import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class GitHubOAuthService {
  private readonly logger = new Logger(GitHubOAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates a 32-byte cryptographically secure random hex string for OAuth state.
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Constructs the GitHub OAuth authorization redirect URL.
   */
  getAuthorizationUrl(state: string): string {
    const clientId =
      this.configService.get<string>('GITHUB_CLIENT_ID') ||
      process.env.GITHUB_CLIENT_ID;
    const callbackUrl =
      this.configService.get<string>('GITHUB_CALLBACK_URL') ||
      process.env.GITHUB_CALLBACK_URL ||
      'http://localhost:3001/auth/github/callback';

    if (!clientId) {
      throw new Error(
        'GITHUB_CLIENT_ID is not configured. OAuth redirect cannot be generated.',
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for a GitHub access token.
   * Never logs authorization code, client secret, or the received token.
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    const clientId =
      this.configService.get<string>('GITHUB_CLIENT_ID') ||
      process.env.GITHUB_CLIENT_ID;
    const clientSecret =
      this.configService.get<string>('GITHUB_CLIENT_SECRET') ||
      process.env.GITHUB_CLIENT_SECRET;
    const callbackUrl =
      this.configService.get<string>('GITHUB_CALLBACK_URL') ||
      process.env.GITHUB_CALLBACK_URL ||
      'http://localhost:3001/auth/github/callback';

    if (!clientId || !clientSecret) {
      this.logger.error('GitHub OAuth credentials are not properly configured.');
      throw new Error('GitHub OAuth credentials not configured');
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      this.logger.warn(`GitHub token exchange failed with HTTP ${response.status}`);
      throw new BadRequestException('Failed to exchange authorization code with GitHub');
    }

    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error || !data.access_token) {
      this.logger.warn(
        `GitHub OAuth token exchange error: ${data.error || 'missing access token'}`,
      );
      throw new BadRequestException(
        data.error_description || 'Invalid or expired authorization code',
      );
    }

    return data.access_token;
  }
}
