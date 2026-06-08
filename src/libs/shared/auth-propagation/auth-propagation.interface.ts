/**
 * Auth Propagation Interfaces
 *
 * Defines types for JWT downstream identity propagation.
 * These types bridge better-auth frontend sessions → jose JWT for BFF→downstream calls.
 */

/**
 * JWT Payload for downstream identity propagation.
 *
 * Per project-context.md security requirements:
 * - sub: UserID
 * - roles: User roles
 * - provider: Channel that originated the request
 * - session_id: better-auth session ID
 * - xi_nghiep: Enterprise/Tenant ID (for KH doanh nghiệp)
 */
export interface JwtPayload {
  /** UserID — from better-auth session */
  sub: string;
  /** User roles — default ['customer'] */
  roles: string[];
  /** Auth channel — 'zalo' | 'hotline' | 'counter' | 'web' */
  provider: string;
  /** better-auth session ID */
  sessionId: string;
  /** Enterprise/Tenant ID (for KH doanh nghiệp) */
  xiNghiep?: string;
}

