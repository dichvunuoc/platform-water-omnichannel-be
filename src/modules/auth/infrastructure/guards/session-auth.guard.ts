/**
 * SessionAuthGuard
 *
 * Global NestJS guard that validates better-auth sessions on every request.
 * Attaches `request.user = { id, sessionId }` for downstream consumption.
 *
 * Routes marked with @Public() bypass this guard entirely.
 *
 * AC: #1 (guard implementation), #4 (global provider via APP_GUARD)
 */

import { Injectable, CanActivate, ExecutionContext, Inject, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { BETTER_AUTH_INSTANCE_TOKEN } from '../../constants/tokens';
import type { BetterAuthInstance } from '../better-auth/better-auth.setup';
import { UnauthorizedException } from '@core/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Interface for the authenticated user object attached to request by this guard.
 */
export interface AuthenticatedUser {
  id: string;
  sessionId: string;
}

/**
 * Augment FastifyRequest to include user property set by SessionAuthGuard.
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly logger = new Logger(SessionAuthGuard.name);

  constructor(
    @Inject(BETTER_AUTH_INSTANCE_TOKEN) private readonly authInstance: BetterAuthInstance,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public via @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    try {
      const api = (this.authInstance as Record<string, unknown>)?.api as
        | Record<string, unknown>
        | undefined;
      const getSessionFn = api?.getSession as
        | ((opts: { headers: Record<string, string | string[] | undefined> }) => Promise<unknown>)
        | undefined;

      const session = await getSessionFn?.({ headers: request.headers });

      if (!session || typeof session !== 'object') {
        throw UnauthorizedException.missingToken();
      }

      const sessionData = session as {
        user?: { id?: string };
        session?: { id?: string };
      };
      if (!sessionData.user?.id) {
        throw UnauthorizedException.missingToken();
      }

      // Attach user to request for @CurrentUser() decorator
      request.user = {
        id: sessionData.user.id,
        sessionId: sessionData.session?.id ?? '',
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn('Failed to extract session from request');
      throw UnauthorizedException.invalidToken('Session verification failed');
    }
  }
}
