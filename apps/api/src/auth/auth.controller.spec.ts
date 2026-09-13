import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthController, OAUTH_STATE_COOKIE_NAME } from './auth.controller';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './github/github-oauth.service';
import { AuthGuard, SESSION_COOKIE_NAME } from './guards/auth.guard';
import { UserDto } from '@cloudpilot/shared';

describe('AuthController & AuthGuard', () => {
  let controller: AuthController;
  let authService: AuthService;
  let oauthService: GitHubOAuthService;
  let authGuard: AuthGuard;

  const mockUser: UserDto = {
    id: 'user-123',
    githubId: '98765',
    username: 'testpilot',
    email: 'pilot@cloudpilot.io',
    name: 'Test Pilot',
    avatarUrl: 'https://avatar.com/testpilot',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockAuthService = {
      validateOAuthState: jest.fn((state, cookieState) => state === cookieState && !!state),
      handleGitHubCallback: jest.fn().mockResolvedValue({
        sessionToken: 'mock_session_token_123',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        user: mockUser,
      }),
      validateSession: jest.fn((token) => {
        if (token === 'valid_session_token') {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
      invalidateSession: jest.fn().mockResolvedValue(undefined),
    };

    const mockOAuthService = {
      generateState: jest.fn().mockReturnValue('mock_random_state_64chars'),
      getAuthorizationUrl: jest.fn(
        (state) => `https://github.com/login/oauth/authorize?client_id=test&state=${state}`,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: GitHubOAuthService, useValue: mockOAuthService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              if (key === 'NODE_ENV') return 'development';
              return null;
            }),
          },
        },
        AuthGuard,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    oauthService = module.get<GitHubOAuthService>(GitHubOAuthService);
    authGuard = module.get<AuthGuard>(AuthGuard);
  });

  describe('GET /auth/github', () => {
    it('should set state cookie and redirect to GitHub authorization URL', async () => {
      const mockRes: any = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.initiateGitHubOAuth(mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        'mock_random_state_64chars',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/auth/github/callback',
        }),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        'https://github.com/login/oauth/authorize?client_id=test&state=mock_random_state_64chars',
      );
    });
  });

  describe('GET /auth/github/callback', () => {
    it('should throw BadRequestException when state cookie is missing', async () => {
      const mockReq: any = { cookies: {} };
      const mockRes: any = { clearCookie: jest.fn() };

      await expect(
        controller.handleGitHubCallback('valid_code', 'state123', mockReq, mockRes),
      ).rejects.toThrow(BadRequestException);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.objectContaining({ path: '/auth/github/callback' }),
      );
    });

    it('should throw BadRequestException when state does not match cookie state', async () => {
      const mockReq: any = { cookies: { [OAUTH_STATE_COOKIE_NAME]: 'expected_state' } };
      const mockRes: any = { clearCookie: jest.fn() };

      await expect(
        controller.handleGitHubCallback('valid_code', 'wrong_state', mockReq, mockRes),
      ).rejects.toThrow(BadRequestException);

      expect(mockRes.clearCookie).toHaveBeenCalled();
    });

    it('should enforce single-use state by clearing state cookie immediately', async () => {
      const mockReq: any = { cookies: { [OAUTH_STATE_COOKIE_NAME]: 'matching_state' } };
      const mockRes: any = {
        clearCookie: jest.fn(),
        cookie: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.handleGitHubCallback('valid_code', 'matching_state', mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.objectContaining({ path: '/auth/github/callback' }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        'mock_session_token_123',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(302, 'http://localhost:3000/dashboard');
    });
  });

  describe('AuthGuard & GET /auth/me', () => {
    it('should throw UnauthorizedException when session cookie is missing', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {}, headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session token is invalid or expired', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { [SESSION_COOKIE_NAME]: 'invalid_token' },
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow access and attach user to request when session is valid', async () => {
      const req: any = {
        cookies: { [SESSION_COOKIE_NAME]: 'valid_session_token' },
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as unknown as ExecutionContext;

      const canActivate = await authGuard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user).toEqual(mockUser);
    });

    it('should return safe CurrentUserResponse from getCurrentUser', async () => {
      const result = await controller.getCurrentUser(mockUser);
      expect(result).toEqual({ user: mockUser });
      expect((result.user as any).accessToken).toBeUndefined();
      expect((result.user as any).clientSecret).toBeUndefined();
    });
  });

  describe('POST /auth/logout', () => {
    it('should invalidate session, clear session cookie, and return success message', async () => {
      const mockReq: any = {
        cookies: { [SESSION_COOKIE_NAME]: 'active_session' },
      };
      const mockRes: any = {
        clearCookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn((payload) => payload),
      };

      const result = await controller.logout(mockReq, mockRes);

      expect(authService.invalidateSession).toHaveBeenCalledWith('active_session');
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.objectContaining({ path: '/', httpOnly: true }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });
});
