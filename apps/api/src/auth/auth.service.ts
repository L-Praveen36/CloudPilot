import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { GitHubOAuthService } from './github/github-oauth.service';
import { GitHubApiService } from './github/github-api.service';
import { UserDto } from '@cloudpilot/shared';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessionTtlMs = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly oauthService: GitHubOAuthService,
    private readonly apiService: GitHubApiService,
  ) {}

  /**
   * Validates the returned OAuth state against the stored cookie state.
   */
  validateOAuthState(
    returnedState: string | undefined | null,
    cookieState: string | undefined | null,
  ): boolean {
    if (!returnedState || !cookieState) {
      return false;
    }
    return this.cryptoService.timingSafeEqual(returnedState, cookieState);
  }

  /**
   * Handles the complete GitHub OAuth authorization callback.
   * Exchanges code, retrieves profile, encrypts token at rest, upserts user, and establishes session.
   */
  async handleGitHubCallback(
    code: string,
  ): Promise<{ sessionToken: string; expiresAt: Date; user: UserDto }> {
    // 1. Exchange code for access token
    const accessToken = await this.oauthService.exchangeCodeForToken(code);

    // 2. Fetch user profile and primary email from GitHub
    const profile = await this.apiService.getProfile(accessToken);
    const email = profile.email || (await this.apiService.getPrimaryEmail(accessToken));

    const githubId = String(profile.id);

    // 3. Encrypt the access token using AES-256-GCM before saving to database
    const encryptedToken = this.cryptoService.encrypt(accessToken);

    // 4. Upsert User and GitHubAccount in a database transaction
    const user = await this.prisma.$transaction(async (tx) => {
      let dbUser = await tx.user.findUnique({
        where: { githubId },
      });

      if (!dbUser) {
        dbUser = await tx.user.create({
          data: {
            githubId,
            username: profile.login,
            email: email || null,
            name: profile.name || null,
            avatarUrl: profile.avatar_url || null,
          },
        });
      } else {
        dbUser = await tx.user.update({
          where: { id: dbUser.id },
          data: {
            username: profile.login,
            email: email || dbUser.email,
            name: profile.name || dbUser.name,
            avatarUrl: profile.avatar_url || dbUser.avatarUrl,
          },
        });
      }

      // Upsert GitHubAccount with encrypted access token
      await tx.gitHubAccount.upsert({
        where: { userId: dbUser.id },
        create: {
          userId: dbUser.id,
          githubId,
          accessToken: encryptedToken,
        },
        update: {
          githubId,
          accessToken: encryptedToken,
        },
      });

      return dbUser;
    });

    // 5. Generate cryptographically secure random session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);

    // 6. Create Session in PostgreSQL
    await this.prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expiresAt,
      },
    });

    this.logger.log(`Session successfully created for user: ${user.username}`);

    const safeUser: UserDto = {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      sessionToken,
      expiresAt,
      user: safeUser,
    };
  }

  /**
   * Validates a session token and returns the sanitized authenticated User.
   * Rejects missing, invalid, or expired sessions.
   */
  async validateSession(sessionToken: string | undefined | null): Promise<UserDto | null> {
    if (!sessionToken || typeof sessionToken !== 'string') {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    // Check expiration
    if (session.expiresAt.getTime() <= Date.now()) {
      // Clean up expired session
      try {
        await this.prisma.session.delete({ where: { id: session.id } });
      } catch {
        // Ignore deletion errors on concurrent cleanup
      }
      return null;
    }

    return {
      id: session.user.id,
      githubId: session.user.githubId,
      username: session.user.username,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };
  }

  /**
   * Invalidates a session by deleting it from PostgreSQL.
   */
  async invalidateSession(sessionToken: string | undefined | null): Promise<void> {
    if (!sessionToken) {
      return;
    }

    try {
      await this.prisma.session.deleteMany({
        where: { sessionToken },
      });
      this.logger.log('Session invalidated successfully');
    } catch (error) {
      this.logger.warn(`Failed to invalidate session: ${(error as Error).message}`);
    }
  }

  /**
   * Internal-only method: retrieves and decrypts the GitHub access token for a user.
   * Never exposed through controllers or DTOs.
   */
  async getDecryptedTokenForUser(userId: string): Promise<string | null> {
    const account = await this.prisma.gitHubAccount.findUnique({
      where: { userId },
    });

    if (!account?.accessToken) {
      return null;
    }

    try {
      return this.cryptoService.decrypt(account.accessToken);
    } catch {
      this.logger.error('Failed to decrypt GitHub access token');
      return null;
    }
  }
}
