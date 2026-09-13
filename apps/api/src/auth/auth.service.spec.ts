import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './github/github-oauth.service';
import { GitHubApiService } from './github/github-api.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import * as crypto from 'crypto';

describe('AuthService', () => {
  let authService: AuthService;
  let oauthService: GitHubOAuthService;
  let apiService: GitHubApiService;
  let prismaService: PrismaService;
  let cryptoService: CryptoService;

  const validEncryptionKey = crypto.randomBytes(32).toString('hex');

  // In-memory mock database
  let mockUsers: any[] = [];
  let mockGitHubAccounts: any[] = [];
  let mockSessions: any[] = [];

  beforeEach(async () => {
    mockUsers = [];
    mockGitHubAccounts = [];
    mockSessions = [];

    const mockPrisma = {
      user: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.githubId) {
            return Promise.resolve(mockUsers.find((u) => u.githubId === where.githubId) || null);
          }
          if (where.id) {
            return Promise.resolve(mockUsers.find((u) => u.id === where.id) || null);
          }
          return Promise.resolve(null);
        }),
        create: jest.fn(({ data }: any) => {
          const user = {
            id: 'uuid-user-' + Math.random().toString(36).substring(2, 9),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockUsers.push(user);
          return Promise.resolve(user);
        }),
        update: jest.fn(({ where, data }: any) => {
          const index = mockUsers.findIndex((u) => u.id === where.id);
          if (index !== -1) {
            mockUsers[index] = { ...mockUsers[index], ...data, updatedAt: new Date() };
            return Promise.resolve(mockUsers[index]);
          }
          return Promise.resolve(null);
        }),
      },
      gitHubAccount: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.userId) {
            return Promise.resolve(mockGitHubAccounts.find((a) => a.userId === where.userId) || null);
          }
          return Promise.resolve(null);
        }),
        upsert: jest.fn(({ where, create, update }: any) => {
          const index = mockGitHubAccounts.findIndex((a) => a.userId === where.userId);
          if (index !== -1) {
            mockGitHubAccounts[index] = {
              ...mockGitHubAccounts[index],
              ...update,
              updatedAt: new Date(),
            };
            return Promise.resolve(mockGitHubAccounts[index]);
          } else {
            const acc = {
              id: 'uuid-acc-' + Math.random().toString(36).substring(2, 9),
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockGitHubAccounts.push(acc);
            return Promise.resolve(acc);
          }
        }),
      },
      session: {
        findUnique: jest.fn(({ where }: any) => {
          const sess = mockSessions.find((s) => s.sessionToken === where.sessionToken);
          if (sess) {
            const user = mockUsers.find((u) => u.id === sess.userId);
            return Promise.resolve({ ...sess, user });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn(({ data }: any) => {
          const sess = {
            id: 'uuid-sess-' + Math.random().toString(36).substring(2, 9),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockSessions.push(sess);
          return Promise.resolve(sess);
        }),
        delete: jest.fn(({ where }: any) => {
          const index = mockSessions.findIndex((s) => s.id === where.id);
          if (index !== -1) {
            const [deleted] = mockSessions.splice(index, 1);
            return Promise.resolve(deleted);
          }
          return Promise.resolve(null);
        }),
        deleteMany: jest.fn(({ where }: any) => {
          const initialLength = mockSessions.length;
          mockSessions = mockSessions.filter((s) => s.sessionToken !== where.sessionToken);
          return Promise.resolve({ count: initialLength - mockSessions.length });
        }),
      },
      $transaction: jest.fn((callback: any) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        GitHubOAuthService,
        GitHubApiService,
        CryptoService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GITHUB_TOKEN_ENCRYPTION_KEY') return validEncryptionKey;
              if (key === 'GITHUB_CLIENT_ID') return 'mock_client_id';
              if (key === 'GITHUB_CLIENT_SECRET') return 'mock_client_secret';
              if (key === 'GITHUB_CALLBACK_URL') return 'http://localhost:3001/auth/github/callback';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return null;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    oauthService = module.get<GitHubOAuthService>(GitHubOAuthService);
    apiService = module.get<GitHubApiService>(GitHubApiService);
    prismaService = module.get<PrismaService>(PrismaService);
    cryptoService = module.get<CryptoService>(CryptoService);

    cryptoService.onModuleInit();
  });

  describe('1. OAuth Authorization URL Generation', () => {
    it('should generate a valid GitHub OAuth authorization URL with required parameters', () => {
      const state = oauthService.generateState();
      expect(state).toHaveLength(64); // 32 bytes hex = 64 chars

      const url = oauthService.getAuthorizationUrl(state);
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=mock_client_id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fgithub%2Fcallback');
      expect(url).toContain('state=' + state);
      expect(url).toContain('scope=read%3Auser+user%3Aemail');
    });
  });

  describe('2-5. OAuth State Validation (CSRF Protection)', () => {
    it('2. should reject when state is missing', () => {
      expect(authService.validateOAuthState(undefined, 'valid_state')).toBe(false);
      expect(authService.validateOAuthState('', 'valid_state')).toBe(false);
    });

    it('3. should reject when stored cookie state is missing', () => {
      expect(authService.validateOAuthState('some_state', undefined)).toBe(false);
      expect(authService.validateOAuthState('some_state', null)).toBe(false);
    });

    it('4. should reject when state does not match (tampering attempt)', () => {
      const stateA = oauthService.generateState();
      const stateB = oauthService.generateState();
      expect(authService.validateOAuthState(stateA, stateB)).toBe(false);
    });

    it('5. should succeed when valid state matches cookie state exactly', () => {
      const state = oauthService.generateState();
      expect(authService.validateOAuthState(state, state)).toBe(true);
    });
  });

  describe('6-10. Token Exchange & Error Handling', () => {
    it('6. should reject invalid OAuth code gracefully', async () => {
      jest.spyOn(oauthService, 'exchangeCodeForToken').mockRejectedValue(
        new BadRequestException('Invalid or expired authorization code'),
      );

      await expect(authService.handleGitHubCallback('bad_code')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('7. should successfully create a new user on valid OAuth callback', async () => {
      const rawToken = 'gho_fresh_test_token_12345';
      jest.spyOn(oauthService, 'exchangeCodeForToken').mockResolvedValue(rawToken);
      jest.spyOn(apiService, 'getProfile').mockResolvedValue({
        id: 1234567,
        login: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/1234567',
      });
      jest.spyOn(apiService, 'getPrimaryEmail').mockResolvedValue('octocat@github.com');

      const result = await authService.handleGitHubCallback('valid_code');

      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken).toHaveLength(64);
      expect(result.user.githubId).toBe('1234567');
      expect(result.user.username).toBe('octocat');
      expect(result.user.email).toBe('octocat@github.com');
      expect(mockUsers.length).toBe(1);
      expect(mockGitHubAccounts.length).toBe(1);
    });

    it('8. should update existing user on subsequent login rather than duplicating', async () => {
      const rawToken = 'gho_token_1';
      jest.spyOn(oauthService, 'exchangeCodeForToken').mockResolvedValue(rawToken);
      jest.spyOn(apiService, 'getProfile').mockResolvedValue({
        id: 1234567,
        login: 'octocat_updated',
        name: 'Updated Name',
        email: 'updated@github.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/1234567?v=2',
      });
      jest.spyOn(apiService, 'getPrimaryEmail').mockResolvedValue('updated@github.com');

      // First login
      await authService.handleGitHubCallback('code_1');
      expect(mockUsers.length).toBe(1);

      // Second login with same GitHub ID
      await authService.handleGitHubCallback('code_2');
      expect(mockUsers.length).toBe(1);
      expect(mockUsers[0].username).toBe('octocat_updated');
      expect(mockUsers[0].email).toBe('updated@github.com');
    });

    it('9. should encrypt GitHub access token before saving to database (AES-256-GCM)', async () => {
      const rawToken = 'gho_sensitive_token_never_plain_in_db';
      jest.spyOn(oauthService, 'exchangeCodeForToken').mockResolvedValue(rawToken);
      jest.spyOn(apiService, 'getProfile').mockResolvedValue({
        id: 99999,
        login: 'crypto_user',
        name: 'Crypto User',
        email: 'crypto@test.com',
        avatar_url: null,
      });

      await authService.handleGitHubCallback('code_crypto');

      const storedAccount = mockGitHubAccounts[0];
      expect(storedAccount.accessToken).toBeDefined();
      expect(storedAccount.accessToken).not.toEqual(rawToken);
      expect(storedAccount.accessToken).toContain(':'); // iv:authTag:ciphertext format
    });

    it('10. should allow internal decryption of stored token when needed', async () => {
      const rawToken = 'gho_token_to_decrypt';
      jest.spyOn(oauthService, 'exchangeCodeForToken').mockResolvedValue(rawToken);
      jest.spyOn(apiService, 'getProfile').mockResolvedValue({
        id: 88888,
        login: 'decrypt_user',
        name: 'Decrypt User',
        email: 'decrypt@test.com',
        avatar_url: null,
      });

      const { user } = await authService.handleGitHubCallback('code_decrypt');
      const decrypted = await authService.getDecryptedTokenForUser(user.id);

      expect(decrypted).toEqual(rawToken);
    });
  });

  describe('11-12. Response Safety & Token Isolation', () => {
    it('11. should never include accessToken or secrets in UserDto', async () => {
      const rawToken = 'gho_secret_access_token';
      jest.spyOn(oauthService, 'exchangeCodeForToken').mockResolvedValue(rawToken);
      jest.spyOn(apiService, 'getProfile').mockResolvedValue({
        id: 77777,
        login: 'safe_user',
        name: 'Safe User',
        email: 'safe@test.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/77777',
      });

      const result = await authService.handleGitHubCallback('code_safe');

      expect((result.user as any).accessToken).toBeUndefined();
      expect((result.user as any).clientSecret).toBeUndefined();
      expect((result.user as any).encryptionKey).toBeUndefined();
    });
  });

  describe('13-18. Session Lifecycle & Authentication Guards', () => {
    it('13. should return null when session token is missing', async () => {
      expect(await authService.validateSession(undefined)).toBeNull();
      expect(await authService.validateSession('')).toBeNull();
    });

    it('14. should return null when session token is invalid/unknown', async () => {
      expect(await authService.validateSession('non_existent_token_123')).toBeNull();
    });

    it('15. should reject expired sessions', async () => {
      // Create user
      const user = await prismaService.user.create({
        data: {
          githubId: '55555',
          username: 'expired_user',
          email: 'expired@test.com',
        },
      });

      // Create expired session (1 hour ago)
      await prismaService.session.create({
        data: {
          sessionToken: 'expired_token_12345',
          userId: user.id,
          expiresAt: new Date(Date.now() - 3600 * 1000),
        },
      });

      const validatedUser = await authService.validateSession('expired_token_12345');
      expect(validatedUser).toBeNull();
    });

    it('16. should validate active session and return authenticated user', async () => {
      const user = await prismaService.user.create({
        data: {
          githubId: '44444',
          username: 'active_user',
          email: 'active@test.com',
          name: 'Active User',
          avatarUrl: 'https://avatar.com/44444',
        },
      });

      const validToken = crypto.randomBytes(32).toString('hex');
      await prismaService.session.create({
        data: {
          sessionToken: validToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });

      const validatedUser = await authService.validateSession(validToken);
      expect(validatedUser).toBeDefined();
      expect(validatedUser?.id).toBe(user.id);
      expect(validatedUser?.username).toBe('active_user');
      expect(validatedUser?.email).toBe('active@test.com');
    });

    it('17-18. should invalidate session on logout and prevent further authentication', async () => {
      const user = await prismaService.user.create({
        data: {
          githubId: '33333',
          username: 'logout_user',
          email: 'logout@test.com',
        },
      });

      const sessionToken = crypto.randomBytes(32).toString('hex');
      await prismaService.session.create({
        data: {
          sessionToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });

      // Verify active
      expect(await authService.validateSession(sessionToken)).not.toBeNull();

      // Logout / invalidate
      await authService.invalidateSession(sessionToken);

      // Verify no longer active
      expect(await authService.validateSession(sessionToken)).toBeNull();
    });
  });
});
