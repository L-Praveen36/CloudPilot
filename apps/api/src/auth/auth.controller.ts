import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './github/github-oauth.service';
import { AuthGuard, SESSION_COOKIE_NAME } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { CurrentUserResponse, LogoutResponse, UserDto } from '@cloudpilot/shared';

export const OAUTH_STATE_COOKIE_NAME = 'cloudpilot_oauth_state';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: GitHubOAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /auth/github
   * Initiates the GitHub OAuth authorization flow.
   * Generates a single-use cryptographically secure state and sets a 10-minute HTTP-only cookie.
   */
  @Get('github')
  async initiateGitHubOAuth(@Res() res: Response): Promise<void> {
    const state = this.oauthService.generateState();
    const isProduction =
      (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'production';

    // Store state in a short-lived (10 min) HTTP-only cookie for CSRF validation
    res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth/github/callback',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    const authorizationUrl = this.oauthService.getAuthorizationUrl(state);
    return res.redirect(302, authorizationUrl);
  }

  /**
   * GET /auth/github/callback
   * Receives authorization code and state from GitHub.
   * Validates state (single-use CSRF check), exchanges code, creates session, and redirects to dashboard.
   */
  @Get('github/callback')
  async handleGitHubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const isProduction =
      (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'production';
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';

    const cookieState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];

    // Immediately clear the state cookie to enforce single-use
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth/github/callback',
    });

    // Validate state
    if (!state || !cookieState || !this.authService.validateOAuthState(state, cookieState)) {
      this.logger.warn('OAuth callback rejected: Invalid, missing, or mismatched state.');
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    if (!code) {
      this.logger.warn('OAuth callback rejected: Missing authorization code.');
      throw new BadRequestException('Authorization code is missing');
    }

    try {
      const { sessionToken, expiresAt } = await this.authService.handleGitHubCallback(code);

      // Set secure HTTP-only session cookie
      res.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      return res.redirect(302, `${frontendUrl}/dashboard`);
    } catch (error) {
      this.logger.warn(
        `OAuth callback failed: ${(error as Error).message}`,
      );
      throw new BadRequestException('Authentication failed');
    }
  }

  /**
   * GET /auth/me
   * Returns current authenticated user. Rejects unauthenticated requests with HTTP 401.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@CurrentUser() user: UserDto): Promise<CurrentUserResponse> {
    return { user };
  }

  /**
   * POST /auth/logout
   * Invalidates the server-side session and clears the session cookie.
   */
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<Response<LogoutResponse>> {
    const isProduction =
      (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'production';
    const sessionToken = req.cookies?.[SESSION_COOKIE_NAME];

    if (sessionToken) {
      await this.authService.invalidateSession(sessionToken);
    }

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
