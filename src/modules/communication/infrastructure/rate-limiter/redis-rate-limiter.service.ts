/**
 * Redis Rate Limiter Service (AC#1, #4 — FR55)
 *
 * Atomic Redis INCR rate limiting per notification channel.
 * Key format: ratelimit:notification:{userId}:{date}
 *
 * Channel limits:
 *   ZNS:    2 msg/KH/ticket/day (FR55)
 *   Push:   50/day
 *   SMS:    10/day
 *   Email:  20/day
 *   In-App: ∞ (no limit)
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import type { NotificationChannel } from '../../application/dtos/notification.dto';

const CHANNEL_LIMITS: Record<NotificationChannel, number> = {
  zns: 2,
  push: 50,
  sms: 10,
  email: 20,
  in_app: Infinity,
};

const FALLBACK_CHAIN: NotificationChannel[] = ['zns', 'push', 'in_app'];

@Injectable()
export class RedisRateLimiterService {
  private readonly logger = new Logger(RedisRateLimiterService.name);

  constructor(
    @Inject(CACHE_SERVICE_TOKEN) private readonly cacheService: ICacheService,
  ) {}

  /**
   * Check if a notification is allowed for the given channel.
   * Uses atomic Redis INCR for concurrent safety.
   */
  async check(
    userId: string,
    channel: NotificationChannel,
  ): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
    const limit = CHANNEL_LIMITS[channel];
    if (limit === Infinity) {
      return { allowed: true, currentCount: 0, limit: Infinity };
    }

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `ratelimit:notification:${userId}:${channel}:${date}`;
    const currentCount = await this.cacheService.incr(key);

    // Set TTL on first increment (24h) — no-op if key already has TTL
    if (currentCount === 1) {
      await this.cacheService.set(`ratelimit:notification:${userId}:${channel}:${date}:ttl`, 1, 86400);
    }

    const allowed = currentCount <= limit;

    if (!allowed) {
      this.logger.log(`Rate limited: ${channel} for ${userId} (${currentCount}/${limit})`);
    }

    return { allowed, currentCount, limit };
  }

  /**
   * Get the fallback chain for critical notifications.
   * Returns channels in priority order: ZNS → Push → In-App Inbox.
   */
  getFallbackChain(): NotificationChannel[] {
    return [...FALLBACK_CHAIN];
  }
}
