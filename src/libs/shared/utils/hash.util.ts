/**
 * Hash Utility
 *
 * Deterministic short-hash function for cache keys, idempotency keys,
 * and any key that needs consistent output across restarts.
 *
 * Uses SHA-256 truncated to 16 hex chars for collision resistance
 * while keeping Redis key lengths reasonable.
 */

import { createHash } from 'crypto';

/**
 * Generate a deterministic short hash from any string payload.
 *
 * @param payload - The string to hash
 * @param length - Number of hex chars to keep (default 16, max 64)
 * @returns Lowercase hex string
 */
export function generateShortHash(payload: string, length: number = 16): string {
  return createHash('sha256').update(payload).digest('hex').substring(0, length);
}
