import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { GitHubUserProfile, GitHubEmail } from '@cloudpilot/shared';

@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name);

  /**
   * Retrieves the authenticated GitHub user profile.
   */
  async getProfile(accessToken: string): Promise<GitHubUserProfile> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CloudPilot-OAuth',
      },
    });

    if (!response.ok) {
      this.logger.warn(`Failed to fetch GitHub profile. HTTP Status: ${response.status}`);
      throw new UnauthorizedException('Failed to retrieve GitHub user profile');
    }

    const data = (await response.json()) as GitHubUserProfile;
    return {
      id: data.id,
      login: data.login,
      name: data.name,
      email: data.email,
      avatar_url: data.avatar_url,
    };
  }

  /**
   * Retrieves user emails and extracts the primary verified email.
   */
  async getPrimaryEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'CloudPilot-OAuth',
        },
      });

      if (!response.ok) {
        return null;
      }

      const emails = (await response.json()) as GitHubEmail[];
      if (!Array.isArray(emails)) {
        return null;
      }

      const primaryVerified = emails.find((e) => e.primary && e.verified);
      if (primaryVerified) {
        return primaryVerified.email;
      }

      const verified = emails.find((e) => e.verified);
      if (verified) {
        return verified.email;
      }

      return emails[0]?.email || null;
    } catch {
      this.logger.warn('Failed to retrieve secondary emails from GitHub');
      return null;
    }
  }
}
