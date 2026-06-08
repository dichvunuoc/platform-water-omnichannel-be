import 'fastify';

/**
 * Fastify type augmentations for better-auth integration.
 *
 * better-auth attaches session/user data to the request object
 * after session verification. These augmentations make the
 * types available to TypeScript without unsafe casts.
 */
declare module 'fastify' {
  interface FastifyRequest {
    /**
     * better-auth session data — populated after cookie-based session verification.
     * Contains the authenticated user's identity.
     */
    session?: {
      id?: string;
      user?: {
        id?: string;
        name?: string;
        email?: string;
        role?: string;
        provider?: string;
        image?: string;
      };
    };
  }
}
