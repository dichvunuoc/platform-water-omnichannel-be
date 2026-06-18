/**
 * Provider Link Repository
 *
 * Queries/inserts the `provider_links` table — the mapping between an external
 * identity provider (e.g. a Zalo OA user id) and an internal User.
 *
 * Used by the Zalo webhook Account Linking flow:
 *  - findByProvider('zalo', zaloUserId) → resolve an inbound Zalo sender to a userId
 *  - link(...) → persist the mapping after OAuth phone verification
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE_WRITE_TOKEN } from '@shared/database/drizzle/database.provider';
import type { DrizzleDB } from '@shared/database/drizzle/database.type';
import {
  providerLinksTable,
  type ProviderLinkRecord,
} from './schema/provider-link.schema';

export type ProviderType = 'phone' | 'zalo' | 'google' | 'facebook' | 'apple';

@Injectable()
export class ProviderLinkRepository {
  private readonly logger = new Logger(ProviderLinkRepository.name);

  constructor(
    @Inject(DATABASE_WRITE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  /**
   * Find an existing link for a provider + providerId.
   * Returns the link record (with userId) if one exists, else null.
   */
  async findByProvider(
    providerType: ProviderType,
    providerId: string,
  ): Promise<ProviderLinkRecord | null> {
    const rows = await this.db
      .select()
      .from(providerLinksTable)
      .where(
        and(
          eq(providerLinksTable.providerType, providerType),
          eq(providerLinksTable.providerId, providerId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Persist a link between an external provider identity and an internal User.
   * Idempotent-ish: relies on the unique(provider_type, provider_id) index —
   * callers should findByProvider first to avoid duplicate-link conflicts.
   */
  async link(input: {
    userId: string;
    providerType: ProviderType;
    providerId: string;
    providerEmail?: string;
    isVerified?: boolean;
  }): Promise<void> {
    await this.db.insert(providerLinksTable).values({
      id: `pl_${input.providerType}_${input.providerId}`,
      userId: input.userId,
      providerType: input.providerType,
      providerId: input.providerId,
      providerEmail: input.providerEmail ?? null,
      isVerified: input.isVerified ?? true,
    });
    this.logger.log(
      `Linked ${input.providerType}:${input.providerId} → user ${input.userId}`,
    );
  }
}
