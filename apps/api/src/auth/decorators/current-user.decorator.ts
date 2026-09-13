import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDto } from '@cloudpilot/shared';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserDto => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
