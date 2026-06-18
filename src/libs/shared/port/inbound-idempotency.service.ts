/**
 * Inbound Idempotency Service
 *
 * Handles webhook deduplication by checking/storing results keyed by
 * a SHA-256 hash of the inbound message identifier (messageId/callId).
 *
 * Key format: idempotency:{sha256Hash}
 * TTL: 86400s (24 hours)
 *
 * AC: #7 — Inbound Idempotency
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '../../core';
import type { ICacheService } from '../caching/cache.interface';
import { generateShortHash } from '../utils/hash.util';

/**
 * Result of an inbound idempotency check.
 */
export interface InboundIdempotencyResult<T = unknown> {
  /** Whether a cached result was found for this key */
  hit: boolean;
  /** The cached data if hit=true */
  data?: T;
}

/**
 * Service for inbound webhook idempotency.
 *
 * Distinct from the CQRS `IdempotencyService` in `libs/shared/cqrs/`:
 * - This uses a dedicated key prefix `idempotency:` with 24h TTL
 * - Designed for webhook dedup (messageId/callId → hash)
 * - Simpler API: check/store vs getExisting/store
 */
@Injectable()
export class InboundIdempotencyService {
  private readonly logger = new Logger(InboundIdempotencyService.name);
  private readonly KEY_PREFIX = 'idempotency';
  private readonly DEFAULT_TTL = 86400; // 24 hours

  constructor(
    @Optional()
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService?: ICacheService,
  ) {
    if (!this.cacheService) {
      this.logger.warn(
        'InboundIdempotencyService initialized without cache service. Idempotency checks will always miss.',
      );
    }
  }

  /**
   * Check if an inbound request was already processed.
   *
   * @param rawKey - The raw message identifier (messageId, callId, etc.)
   * @returns InboundIdempotencyResult with hit=true and data if found
   *
   * AC: #7 — Redis GET idempotency:{hash} → if EXISTS return cached response
   */
  async check<T = unknown>(rawKey: string): Promise<InboundIdempotencyResult<T>> {
    if (!this.cacheService) {
      return { hit: false };
    }

    const cacheKey = this.buildCacheKey(rawKey);

    try {
      const cached = await this.cacheService.get<T>(cacheKey);
      if (cached !== null && cached !== undefined) {
        this.logger.debug(`Idempotency HIT: ${cacheKey}`);
        return { hit: true, data: cached };
      }
    } catch (error) {
      this.logger.warn(
        `Cache error checking idempotency for ${cacheKey}: ${(error as Error).message}`,
      );
    }

    this.logger.debug(`Idempotency MISS: ${cacheKey}`);
    return { hit: false };
  }

  /**
   * Atomically CLAIM an inbound request id (SETNX), closing the check-then-act race.
   *
   * Use at ingress (webhook controller): the FIRST caller wins (returns true) and
   * proceeds; concurrent/retry duplicates lose (returns false) and must be dropped.
   * This is the proper implementation of the "SETNX message_id 24h → drop retry"
   * idempotency requirement (no duplicate outbox rows under concurrent retries).
   *
   * @returns true if this caller acquired the key (proceed), false if already claimed (drop).
   */
  async claim(rawKey: string): Promise<boolean> {
    if (!this.cacheService) {
      return true; // no cache → no dedup possible → allow processing
    }
    try {
      const won = await this.cacheService.setIfNotExist(
        this.buildCacheKey(rawKey),
        'claimed',
        this.DEFAULT_TTL,
      );
      if (won) {
        this.logger.debug(`Idempotency CLAIMED: ${this.buildCacheKey(rawKey)}`);
      } else {
        this.logger.debug(`Idempotency CLAIM-LOST (duplicate): ${this.buildCacheKey(rawKey)}`);
      }
      return won;
    } catch (error) {
      this.logger.warn(
        `Cache error claiming idempotency for ${rawKey}: ${(error as Error).message}`,
      );
      return true; // fail-open: allow processing if the claim store is unavailable
    }
  }

  /**
   * Store the result of a processed inbound request.
   *
   * @param rawKey - The raw message identifier (messageId, callId, etc.)
   * @param result - The result to cache
   *
   * AC: #7 — Redis SET idempotency:{hash} = result, TTL 24h
   */
  async store<T = unknown>(rawKey: string, result: T): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    const cacheKey = this.buildCacheKey(rawKey);

    try {
      await this.cacheService.set(cacheKey, result, this.DEFAULT_TTL);
      this.logger.debug(
        `Stored idempotency result for ${cacheKey} (TTL: ${this.DEFAULT_TTL}s)`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to store idempotency result for ${cacheKey}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Build the cache key from a raw message identifier.
   *
   * Format: idempotency:{sha256Hash}
   * Where hash = SHA-256(rawKey), truncated to 16 chars for consistency
   * with the project's cache key pattern.
   */
  private buildCacheKey(rawKey: string): string {
    const hash = generateShortHash(rawKey);
    return `${this.KEY_PREFIX}:${hash}`;
  }
}
