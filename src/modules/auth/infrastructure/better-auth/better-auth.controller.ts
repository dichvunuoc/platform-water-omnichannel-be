import { Controller, All, Req, Res, Logger, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { BETTER_AUTH_INSTANCE_TOKEN } from '../../constants/tokens';
import type { BetterAuthInstance } from './better-auth.setup';

/**
 * Better Auth Controller
 *
 * Mounts the better-auth handler on NestJS Fastify routes.
 * All requests to /api/auth/* are handled by better-auth directly.
 *
 * CRITICAL: Requires bodyParser: false in main.ts
 * better-auth needs raw body access for signature verification.
 */
@ApiTags('BetterAuth')
@Controller('api/auth')
export class BetterAuthController {
  private readonly logger = new Logger(BetterAuthController.name);

  constructor(
    @Inject(BETTER_AUTH_INSTANCE_TOKEN)
    private readonly authInstance: BetterAuthInstance,
  ) {}

  /**
   * Catch-all handler for better-auth routes.
   * Delegates to the better-auth handler for:
   * - POST /api/auth/sign-in/phone — Phone/OTP login
   * - POST /api/auth/verify-phone — OTP verification
   * - GET /api/auth/sign-in/social — Social OAuth redirect
   * - GET /api/auth/callback/social — Social OAuth callback
   * - POST /api/auth/sign-out — Sign out
   * - GET /api/auth/session — Get current session
   */
  @All('*')
  @ApiExcludeEndpoint()
  async handleAuth(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const handler = (this.authInstance as Record<string, unknown>)?.handler;

    if (typeof handler === 'function') {
      try {
        // CRITICAL: Pass Node.js IncomingMessage/ServerResponse (request.raw/reply.raw),
        // not Fastify's wrapper objects. better-auth expects standard Node.js request/reply
        // with properties like `req.headers`, `res.setHeader()`, etc. Fastify's wrapper
        // may be missing or redefining properties that better-auth relies on.
        await (handler as (req: unknown, res: unknown) => Promise<void>)(
          request.raw,
          reply.raw,
        );
      } catch (error) {
        this.logger.error('Better-auth handler error', error);
        reply.status(500).send({ error: 'Authentication error' });
      }
    } else {
      this.logger.warn('Better-auth handler not available');
      reply.status(503).send({ error: 'Authentication service unavailable' });
    }
  }
}
