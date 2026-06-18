import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  DATABASE_WRITE_TOKEN,
} from '@core/constants/tokens';
import {
  PII_ENCRYPTION_SERVICE_TOKEN,
  AUTH_PORT_TOKEN,
  BETTER_AUTH_INSTANCE_TOKEN,
} from './constants/tokens';

// Infrastructure
import { AuthController } from './infrastructure/http/auth.controller';
import { BetterAuthController } from './infrastructure/better-auth/better-auth.controller';
import { PiiEncryptionService } from './infrastructure/persistence/encryption/pii-encryption.service';
import { MockAuthAdapter } from './infrastructure/ports/auth.port';
import { ZaloOAuthProvider } from './infrastructure/oauth/zalo-oauth.provider';
import { createBetterAuth } from './infrastructure/better-auth/better-auth.setup';
import { SessionAuthGuard } from './infrastructure/guards/session-auth.guard';
// Zalo OA Account Linking (omnichannel) — nonce store is shared with the
// Communication module via the global CACHE_SERVICE_TOKEN (same Redis), so
// both modules register ZaloOAuthStateService without a circular import.
import { ProviderLinkRepository } from './infrastructure/persistence/drizzle/provider-link.repository';
import { ZaloOAuthStateService } from '@modules/communication/infrastructure/zalo/zalo-oauth-state.service';
import { ZaloAccountLinkingService } from './application/zalo-account-linking.service';

/**
 * Auth Module
 *
 * Handles customer authentication via better-auth.
 * - better-auth manages sessions, OTP, OAuth flows, and local identity tables
 * - AuthController provides thin REST endpoints with input validation
 * - Customer data sync to Backend API is done via PortHttpClient
 *
 * NOTE: CQRS handlers removed — better-auth owns the local auth identity tables.
 * Business user data (customer profile, contracts, etc.) lives in Backend API.
 */
@Module({
  controllers: [AuthController, BetterAuthController],
  providers: [
    // Infrastructure Services
    MockAuthAdapter,
    ZaloOAuthProvider,

    // PII Encryption Service (used by better-auth databaseHooks)
    {
      provide: PII_ENCRYPTION_SERVICE_TOKEN,
      useClass: PiiEncryptionService,
    } as Provider,

    // Auth Port (Mock adapter — live adapter calls Backend API)
    {
      provide: AUTH_PORT_TOKEN,
      useClass: MockAuthAdapter,
    } as Provider,

    // Better Auth Instance (needs DB + config for drizzleAdapter)
    {
      provide: BETTER_AUTH_INSTANCE_TOKEN,
      useFactory: (db: unknown, configService: ConfigService) => {
        return createBetterAuth(db, configService);
      },
      inject: [DATABASE_WRITE_TOKEN, ConfigService],
    },

    // SessionAuthGuard — registered as global APP_GUARD so every endpoint
    // is authenticated by default. Use @Public() to bypass on specific routes.
    SessionAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: SessionAuthGuard,
    },

    // Zalo OA omnichannel Account Linking (nonce store + provider-link repo + linking service)
    ProviderLinkRepository,
    ZaloOAuthStateService,
    ZaloAccountLinkingService,
  ],
  exports: [
    PII_ENCRYPTION_SERVICE_TOKEN,
    AUTH_PORT_TOKEN,
  ],
})
export class AuthModule {}
