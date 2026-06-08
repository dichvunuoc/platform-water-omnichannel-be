import { Injectable, Inject, Logger, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { REQUEST_CONTEXT_TOKEN } from '../../core';
import type { IRequestContextProvider } from '../../core';
import { JwtSignerService } from './jwt-signer.service';

/**
 * Shape of better-auth session data attached to the request.
 * better-auth populates `req.session` after cookie-based verification.
 */
interface BetterAuthSession {
  id?: string;
  user?: {
    id?: string;
    role?: string;
    provider?: string;
  };
}

/**
 * Auth Propagation Middleware
 *
 * Extracts user identity from better-auth session and enriches RequestContext.
 * Runs AFTER CorrelationIdMiddleware (which creates the initial context).
 *
 * Flow:
 * 1. Reads better-auth session from req.session (set by better-auth after cookie verify)
 * 2. Extracts userId, roles, provider, sessionId
 * 3. Signs a 15-min JWT via jose and caches it in RequestContext.metadata.signedJwt
 * 4. PortHttpClient reads the cached JWT — no re-signing needed per downstream call
 *
 * Performance: With AggregationService fan-out (5+ parallel calls), this avoids
 * signing 5 identical JWTs. One sign per request, reused across all downstream calls.
 *
 * SKIP for: webhook endpoints, health checks, public routes
 * (detected by absence of user identity in request)
 */
@Injectable()
export class AuthPropagationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthPropagationMiddleware.name);

  constructor(
    @Inject(REQUEST_CONTEXT_TOKEN)
    private readonly contextProvider: IRequestContextProvider,
    private readonly jwtSigner: JwtSignerService,
  ) {}

  /**
   * Extract user identity from request and enrich RequestContext.
   */
  async use(
    req: FastifyRequest,
    _reply: FastifyReply,
    next: () => void,
  ): Promise<void> {
    const context = this.contextProvider.current();
    if (!context) {
      // No context — CorrelationIdMiddleware should have created one
      return next();
    }

    // Extract user identity from better-auth session
    const session = this.extractSession(req);
    if (!session?.user?.id) {
      // No authenticated user — proceed without JWT enrichment
      // (webhooks, health checks, public routes)
      return next();
    }

    const userId = session.user.id;
    const roles = this.extractRoles(session);
    const provider = this.extractProvider(session, req);
    const sessionId = this.extractSessionId(session, req);

    // Sign JWT once per request and cache in RequestContext.metadata.
    // PortHttpClient reads metadata.signedJwt instead of calling jwtSigner.sign()
    // on every downstream call — avoids redundant HS256 signing during fan-out.
    const signedJwt = await this.jwtSigner.sign({
      sub: userId,
      roles,
      provider,
      sessionId,
      xiNghiep: context.tenantId,
    });

    // Enrich RequestContext with auth identity + pre-signed JWT in metadata
    const enriched = this.contextProvider.createFull({
      correlationId: context.correlationId,
      userId,
      tenantId: context.tenantId,
      metadata: {
        ...context.metadata,
        roles,
        provider,
        sessionId,
        signedJwt,
      },
    });

    this.contextProvider.run(enriched, () => next());
  }

  /**
   * Extract better-auth session from request.
   * Uses the augmented FastifyRequest type (see src/types/fastify.d.ts)
   * instead of unsafe `as unknown as Record` casts.
   */
  private extractSession(req: FastifyRequest): BetterAuthSession | null {
    const session = req.session;
    if (session && typeof session === 'object') {
      return session as BetterAuthSession;
    }
    return null;
  }

  /**
   * Extract roles from session user, fallback to ['customer'].
   */
  private extractRoles(session: BetterAuthSession): string[] {
    if (session.user?.role) {
      return [session.user.role];
    }
    return ['customer'];
  }

  /**
   * Extract provider — prefers session data, falls back to x-auth-provider header, then 'web'.
   */
  private extractProvider(session: BetterAuthSession, req: FastifyRequest): string {
    if (session.user?.provider) {
      return session.user.provider;
    }
    return (req.headers['x-auth-provider'] as string) ?? 'web';
  }

  /**
   * Extract session ID — prefers session.id, falls back to x-session-id header.
   */
  private extractSessionId(session: BetterAuthSession, req: FastifyRequest): string {
    if (session.id) {
      return session.id;
    }
    return (req.headers['x-session-id'] as string) ?? '';
  }
}
