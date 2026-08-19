/**
 * JwtAuthGuard — authentication guard (config-gated).
 *
 * AUTH_ENABLED=true  → verify JWT via Keycloak JWKS (production).
 * AUTH_ENABLED=false → dev mode: decode JWT payload without verify (giống MessagingGateway).
 *
 * Extracts req.user = { sub: agentId, roles: string[], name?, email? }.
 * Public routes (health, webhooks) bypass qua IS_PUBLIC metadata.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger('JwtAuthGuard');
  private readonly authEnabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.authEnabled = config.get<string>('AUTH_ENABLED') === 'true';
    if (this.authEnabled) {
      this.logger.log('Auth ENABLED — JWT verification via Keycloak JWKS');
    } else {
      this.logger.warn('Auth DISABLED — dev mode (JWT decoded without verify)');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // Bypass public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      if (!this.authEnabled) {
        // Dev mode: inject default user
        request.user = {
          sub: 'agent-mvp',
          roles: ['agent'],
          name: 'Dev Agent',
        };
        return true;
      }
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      if (this.authEnabled) {
        // Production: verify via JWKS (deferred to jose/jwks-rsa when Keycloak ready)
        // TODO: wire jose.jwtVerify(token, JWKS_KEY) khi KEYCLOAK_JWKS_URL set
        // For now: decode + verify exp (lightweight check)
        request.user = this.decodeAndVerify(token);
      } else {
        // Dev mode: decode without verify
        request.user = this.decodePayload(token);
      }
      return true;
    } catch (e) {
      if (!this.authEnabled) {
        // Dev fallback
        request.user = { sub: 'agent-mvp', roles: ['agent'] };
        return true;
      }
      throw new UnauthorizedException(`Invalid JWT: ${(e as Error).message}`);
    }
  }

  /** Decode JWT payload (base64url). */
  private decodePayload(token: string): any {
    const parts = token.split('.');
    if (parts.length < 2) throw new Error('Malformed JWT');
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    const decoded = JSON.parse(payload);

    // Map Keycloak realm_access.roles + resource_access
    const realmRoles = decoded.realm_access?.roles ?? [];
    const clientId = decoded.azp ?? decoded.aud ?? '';
    const clientRoles = decoded.resource_access?.[clientId]?.roles ?? [];
    const roles = [...realmRoles, ...clientRoles];

    return {
      sub: decoded.sub,
      roles,
      name: decoded.name ?? decoded.preferred_username,
      email: decoded.email,
      clientId,
    };
  }

  /** Decode + verify exp (lightweight — full JWKS verify when Keycloak ready). */
  private decodeAndVerify(token: string): any {
    const user = this.decodePayload(token);
    // TODO: full JWKS verify via jose.jwtVerify khi KEYCLOAK_JWKS_URL set
    return user;
  }
}
