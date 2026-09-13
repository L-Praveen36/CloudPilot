import { SkipThrottle } from '@nestjs/throttler';

/**
 * Re-export @nestjs/throttler's SkipThrottle for consistent internal imports.
 *
 * Usage:
 *   @SkipThrottle()
 *   @Get('health')
 *   getHealth() { ... }
 */
export { SkipThrottle };
