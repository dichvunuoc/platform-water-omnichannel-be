/**
 * Standardized Auth Response DTO
 *
 * Returned by all auth endpoints (register, login, link, me).
 * Direct return, no wrappers — follows project-context.md API conventions.
 */
export class AuthResponseDto {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  providers: {
    providerType: string;
    providerId: string;
    isVerified: boolean;
  }[];
}

/**
 * Auth Token Response
 * Returned after successful authentication with session info.
 */
export class AuthTokenResponseDto {
  sessionId: string;
  userId: string;
  expiresAt: string;
}
