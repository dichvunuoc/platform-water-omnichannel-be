import { Global, Module } from '@nestjs/common';
import { JwtSignerService } from './jwt-signer.service';
import { AuthPropagationMiddleware } from './auth-propagation.middleware';
import { ContextModule } from '../context/context.module';

/**
 * Auth Propagation Module
 *
 * @Global NestJS module providing JWT signing for BFF→downstream identity propagation.
 *
 * Provides:
 * - JwtSignerService — signs 15-min JWTs via jose for downstream Authorization headers
 * - AuthPropagationMiddleware — extracts user identity from better-auth session → RequestContext
 *
 * Flow: better-auth session → AuthPropagationMiddleware → RequestContext → JwtSignerService → PortHttpClient
 */
@Global()
@Module({
  imports: [ContextModule],
  providers: [JwtSignerService, AuthPropagationMiddleware],
  exports: [JwtSignerService],
})
export class AuthPropagationModule {}
