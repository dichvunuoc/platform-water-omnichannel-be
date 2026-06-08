import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { usersTable } from '../persistence/drizzle/schema/user.schema';
import { providerLinksTable } from '../persistence/drizzle/schema/provider-link.schema';
import { sessionsTable } from '../persistence/drizzle/schema/session.schema';
import { PiiEncryptionService } from '../persistence/encryption/pii-encryption.service';

/**
 * Create and configure the better-auth instance.
 *
 * better-auth handles:
 * - Phone/OTP authentication (via phoneNumber plugin)
 * - OAuth providers: Google, Facebook, Apple (built-in)
 * - Zalo OAuth (via genericOAuth plugin — not a built-in provider)
 * - Session management (cookie-based, 7-day refresh)
 *
 * This is the BFF↔Frontend session concern.
 * BFF→downstream JWT propagation uses jose (Story 1.4).
 *
 * CRITICAL: better-auth writes directly to the database via drizzleAdapter.
 * We intercept writes using databaseHooks to encrypt PII fields (phone, email)
 * and generate HMAC blind index hashes BEFORE data hits the database.
 * Without these hooks, better-auth would store plaintext in columns designed
 * for AES-256-GCM ciphertext, causing decrypt() to crash on read.
 */
export function createBetterAuth(
  db: unknown,
  configService: ConfigService,
) {
  const logger = new Logger('BetterAuth');

  // Initialize PII encryption for database hooks
  const piiEncryption = new PiiEncryptionService(configService);

  return betterAuth({
    database: drizzleAdapter(db as Parameters<typeof drizzleAdapter>[0], {
      provider: 'pg',
      schema: {
        user: usersTable,
        session: sessionsTable,
        account: providerLinksTable, // Map provider links as better-auth "accounts"
      },
    }),
    /**
     * Database hooks — intercept better-auth writes to encrypt PII.
     *
     * better-auth doesn't know about our encryption layer. These hooks
     * ensure every write path (user create, user update) encrypts
     * phone/email and generates blind index hashes before data
     * reaches the database.
     *
     * Read paths (getSession, getUser) receive encrypted data — our
     * UserRepository decrypts on read using PiiEncryptionService.
     */
    databaseHooks: {
      user: {
        // Encrypt PII before creating a new user
        create: {
          before: async (user) => {
            const rawEmail = user.email as string | undefined;
            const rawPhone = (user as Record<string, unknown>).phone as string | undefined;

            return {
              data: {
                ...user,
                email: piiEncryption.encryptIfNeeded(rawEmail) ?? undefined,
                phone: piiEncryption.encryptIfNeeded(rawPhone) ?? undefined,
                emailHash: piiEncryption.hashIfNeeded(rawEmail),
                phoneHash: piiEncryption.hashIfNeeded(rawPhone),
              },
            };
          },
        },
        // Encrypt PII before updating a user
        update: {
          before: async (user) => {
            const rawEmail = user.email as string | undefined;
            const rawPhone = (user as Record<string, unknown>).phone as string | undefined;

            const encrypted: Record<string, unknown> = { ...user };

            if (rawEmail !== undefined) {
              encrypted.email = piiEncryption.encryptIfNeeded(rawEmail) ?? undefined;
              encrypted.emailHash = piiEncryption.hashIfNeeded(rawEmail);
            }
            if (rawPhone !== undefined) {
              encrypted.phone = piiEncryption.encryptIfNeeded(rawPhone) ?? undefined;
              encrypted.phoneHash = piiEncryption.hashIfNeeded(rawPhone);
            }

            return { data: encrypted };
          },
        },
      },
    },
    emailAndPassword: {
      enabled: false, // No username/password — FR1: only Phone/OTP, Zalo, Social
    },
    plugins: [
      // Phone/OTP Authentication
      phoneNumber({
        sendOTP: async ({ phoneNumber: phone, code }) => {
          // Integrate with SMS gateway (Vietnam-based, e.g., eSMS, SpeedSMS)
          // For MVP: log OTP for development testing
          if (process.env.NODE_ENV !== 'production') {
            logger.log(`[DEV] OTP for ${phone.slice(-4).padStart(phone.length, '*')}: ${code}`);
          }
          // TODO: Wire to actual SMS provider in production
        },
        signUpOnVerification: {
          getTempEmail: (phone: string) => `${phone}@cskh.placeholder.local`,
          getTempName: (phone: string) => phone,
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        allowedAttempts: 3, // Brute-force protection
      }),
      // Zalo Custom OAuth Provider (not built-in)
      genericOAuth({
        config: [
          {
            providerId: 'zalo',
            clientId: configService.get('ZALO_APP_ID', ''),
            clientSecret: configService.get('ZALO_APP_SECRET', ''),
            authorizationUrl: 'https://oauth.zaloapp.com/v4/permission',
            tokenUrl: 'https://oauth.zaloapp.com/v4/access_token',
            userInfoUrl: 'https://graph.zalo.me/v2.0/me',
            scopes: ['id', 'name', 'picture'],
            getUserInfo: async (tokens) => {
              const res = await fetch(
                `https://graph.zalo.me/v2.0/me?access_token=${tokens.accessToken}`,
                { headers: { 'Content-Type': 'application/json' } },
              );
              const data = await res.json() as Record<string, unknown>;
              return {
                id: String(data.id),
                name: data.name as string,
                email: `${data.id}@zalo.placeholder.local`,
                emailVerified: false,
                image: (data.picture as { data: { url: string } } | undefined)?.data?.url,
              };
            },
            mapProfileToUser: (profile: Record<string, unknown>) => ({
              name: profile.name as string,
            }),
          },
        ],
      }),
    ],
    socialProviders: {
      google: {
        clientId: configService.get('GOOGLE_CLIENT_ID', ''),
        clientSecret: configService.get('GOOGLE_CLIENT_SECRET', ''),
      },
      facebook: {
        clientId: configService.get('FACEBOOK_CLIENT_ID', ''),
        clientSecret: configService.get('FACEBOOK_CLIENT_SECRET', ''),
      },
      apple: {
        clientId: configService.get('APPLE_CLIENT_ID', ''),
        clientSecret: configService.get('APPLE_CLIENT_SECRET', ''),
        mapProfileToUser: (profile) => ({
          // Apple only emits email on first sign-in — use placeholder after
          email: (profile.email as string) ?? `${profile.sub}@apple.placeholder.local`,
        }),
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60, // 7 days (NFR-S5)
      updateAge: 24 * 60 * 60, // Refresh session every 24h
      freshAge: 24 * 60 * 60, // Session "fresh" within 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 min cookie cache
        strategy: 'compact',
      },
    },
  });
}

/**
 * Type for the better-auth instance.
 * Exported for use in controllers and the auth module.
 */
export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
