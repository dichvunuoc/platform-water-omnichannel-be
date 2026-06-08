import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify, errors } from 'jose';
import type { JwtPayload } from './auth-propagation.interface';

/**
 * JWT Signer Service
 *
 * Uses `jose` library to sign and verify JWTs for BFF→downstream identity propagation.
 * This is the BACKEND PROPAGATION concern (15-min JWT via Authorization header).
 * Do NOT confuse with better-auth frontend session management (7-day cookie).
 *
 * Features:
 * - HS256 symmetric signing
 * - 15-minute TTL (NFR-S4)
 * - Dual-key verification for secret rotation (JWT_SECRET_NEW + JWT_SECRET_OLD)
 *
 * jose v6.2.3 is ESM-only — Bun handles ESM natively.
 */
@Injectable()
export class JwtSignerService {
  private readonly logger = new Logger(JwtSignerService.name);
  private readonly secret: Uint8Array;
  private readonly oldSecret: Uint8Array | null;
  private readonly ttl: string;
  private readonly issuer: string;

  constructor(private readonly configService: ConfigService) {
    const secretStr = this.configService.getOrThrow<string>('JWT_SECRET');
    this.secret = new TextEncoder().encode(secretStr);

    const oldSecretStr = this.configService.get<string>('JWT_SECRET_OLD');
    this.oldSecret = oldSecretStr ? new TextEncoder().encode(oldSecretStr) : null;

    this.ttl = this.configService.get<string>('JWT_TTL', '15m');
    this.issuer = this.configService.get<string>('JWT_ISSUER', 'cskh-bff');
  }

  /**
   * Sign a JWT for downstream propagation.
   *
   * Payload per project-context.md: sub, roles, provider, session_id, xi_nghiep, iat, exp
   *
   * @param payload - User identity from RequestContext
   * @returns Signed JWT string
   */
  async sign(payload: JwtPayload): Promise<string> {
    return new SignJWT({
      sub: payload.sub,
      roles: payload.roles,
      provider: payload.provider,
      session_id: payload.sessionId,
      xi_nghiep: payload.xiNghiep,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .setIssuer(this.issuer)
      .sign(this.secret);
  }

  /**
   * Verify a JWT — tries current secret first, then old secret (rotation support).
   *
   * Rotation flow:
   * 1. Deploy with JWT_SECRET = new-secret, JWT_SECRET_OLD = previous-secret
   * 2. Verify tries new secret first, falls back to old
   * 3. After 24h, remove JWT_SECRET_OLD
   *
   * @param token - JWT string to verify
   * @returns Decoded payload
   * @throws JWTExpired if token expired
   * @throws JWSSignatureVerificationFailed if signature invalid with both keys
   */
  async verify(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.issuer,
      });
      return this.mapPayload(payload);
    } catch (error) {
      // If expired, don't try old secret — expiration is absolute
      if (error instanceof errors.JWTExpired) {
        throw error;
      }

      // Try old secret for rotation support
      if (this.oldSecret) {
        try {
          const { payload } = await jwtVerify(token, this.oldSecret, {
            issuer: this.issuer,
          });
          return this.mapPayload(payload);
        } catch {
          // Old secret also failed — throw original error
          throw error;
        }
      }

      throw error;
    }
  }

  /**
   * Map jose JWT payload to our JwtPayload interface
   */
  private mapPayload(payload: Record<string, unknown>): JwtPayload {
    return {
      sub: payload.sub as string,
      roles: (payload.roles as string[]) ?? ['customer'],
      provider: (payload.provider as string) ?? 'web',
      sessionId: (payload.session_id as string) ?? '',
      xiNghiep: payload.xi_nghiep as string | undefined,
    };
  }
}
