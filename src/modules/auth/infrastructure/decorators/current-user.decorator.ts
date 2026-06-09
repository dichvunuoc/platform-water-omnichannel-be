/**
 * @CurrentUser() Param Decorator
 *
 * Extracts the authenticated user from `request.user` (set by SessionAuthGuard).
 *
 * Usage:
 * - @CurrentUser() user: AuthenticatedUser    → full user object
 * - @CurrentUser('id') userId: string          → just the userId
 * - @CurrentUser('sessionId') sid: string      → just the sessionId
 *
 * AC: #2
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../guards/session-auth.guard';
import { UnauthorizedException } from '@core/common';

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw UnauthorizedException.missingToken();
    }

    return field ? user[field] : user;
  },
);
