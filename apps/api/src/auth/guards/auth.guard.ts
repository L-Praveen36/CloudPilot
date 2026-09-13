import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

export const SESSION_COOKIE_NAME = 'cloudpilot_session';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionToken =
      request.cookies?.[SESSION_COOKIE_NAME] ||
      this.extractCookie(request.headers?.cookie, SESSION_COOKIE_NAME);

    if (!sessionToken) {
      throw new UnauthorizedException('Authentication session required');
    }

    const user = await this.authService.validateSession(sessionToken);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.user = user;
    return true;
  }

  private extractCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) {
      return null;
    }
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
}
