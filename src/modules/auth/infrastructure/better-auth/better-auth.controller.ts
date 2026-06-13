import { Controller, All, Req, Res, Logger, Inject } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { BETTER_AUTH_INSTANCE_TOKEN } from '../../constants/tokens';
import type { BetterAuthInstance } from './better-auth.setup';
import { Public } from '../decorators/public.decorator';

/**
 * Better Auth Controller
 *
 * Mounts the better-auth handler on NestJS Fastify routes.
 * All requests to /api/auth/* are handled by better-auth directly.
 *
 * IMPLEMENTATION NOTE:
 * better-auth's `handler` is a Web API-style handler:
 *   `(request: Request) => Promise<Response>`
 *
 * We construct a standard `Request` from Fastify's request data,
 * call the handler, and forward the `Response` back to Fastify.
 *
 * @Public() — all better-auth routes must bypass SessionAuthGuard.
 * Login, OTP verification, and OAuth callbacks have no session yet.
 */
@Public()
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

    if (typeof handler !== 'function') {
      this.logger.warn('Better-auth handler not available');
      reply.status(503).send({ error: 'Authentication service unavailable' });
      return;
    }

    try {
      // 1. Build the full URL (better-auth needs protocol + host)
      const protocol = request.protocol || 'http';
      const host = request.headers.host || 'localhost:3000';
      const url = `${protocol}://${host}${request.url}`;

      // 2. Construct Web API Headers from Fastify headers
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }

      // 3. Build the Web API Request — better-auth handler expects this
      const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body;
      const webRequest = new Request(url, {
        method: request.method,
        headers,
        body: hasBody ? JSON.stringify(request.body) : undefined,
      });

      // 4. Call better-auth's Web API handler
      const response: Response = await (handler as (req: Request) => Promise<Response>)(webRequest);

      // Debug: log non-2xx responses during development
      if (!response.ok && process.env.NODE_ENV !== 'production') {
        const debugBody = await response.clone().text();
        this.logger.warn(`Better-auth ${request.method} ${request.url} → ${response.status}: ${debugBody}`);
      }

      // 5. Forward the Response back to Fastify
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const responseBody = await response.text();
      reply.send(responseBody);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Better-auth handler error: ${err.message}\n${err.stack}`);
      reply.status(500).send({
        error: 'Authentication error',
        detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      });
    }
  }
}
