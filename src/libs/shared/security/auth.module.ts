/**
 * AuthModule — @Global module providing JwtAuthGuard + RolesGuard.
 *
 * JwtAuthGuard: AUTH_ENABLED=true → JWT verify, false → dev mode (decode without verify).
 * RolesGuard: checks @RequireRole metadata vs req.user.roles.
 *
 * Public routes bypass: @Public() decorator → IS_PUBLIC_KEY metadata.
 */
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './authorization.decorator';

@Global()
@Module({
  providers: [
    // Global authentication guard (runs on every route, @Public() bypasses)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global authorization guard (runs after auth, checks @RequireRole)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
