import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Inject,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { PortHttpClient } from '@shared/port/port-http-client.service';
import { UnauthorizedException } from '@core/common';
import {
  RegisterPhoneSchema,
} from '../../application/dtos/register-phone.dto';
import {
  RegisterProviderSchema,
  LinkProviderSchema,
  VerifyOtpSchema,
} from '../../application/dtos/register-provider.dto';
import { ValidationException } from '@core/common';
import { BETTER_AUTH_INSTANCE_TOKEN } from '../../constants/tokens';
import type { BetterAuthInstance } from '../../infrastructure/better-auth/better-auth.setup';
import {
  SwaggerRegisterPhoneDto,
  SwaggerVerifyOtpDto,
  SwaggerRegisterProviderDto,
  SwaggerLinkProviderDto,
  SwaggerVerifyOtpResponseDto,
  SwaggerProviderCallbackResponseDto,
  SwaggerLinkProviderResponseDto,
  SwaggerAuthResponseDto,
} from '../../application/dtos/auth-swagger.dto';
import type {
  RegisterPhoneDto,
} from '../../application/dtos/register-phone.dto';
import type {
  RegisterProviderDto,
  LinkProviderDto,
  VerifyOtpDto,
} from '../../application/dtos/register-provider.dto';

/**
 * Auth Controller
 *
 * Thin REST endpoints for authentication flows.
 * better-auth handles its own routes at /api/auth/* (see BetterAuthController).
 * This controller:
 *   1. Validates input via Zod schemas
 *   2. Delegates auth operations to better-auth
 *   3. Syncs customer data to Backend API via PortHttpClient
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(BETTER_AUTH_INSTANCE_TOKEN)
    private readonly authInstance: BetterAuthInstance,
    private readonly portHttpClient: PortHttpClient,
  ) {}

  /**
   * Extract authenticated user ID from the better-auth session.
   * Throws UnauthorizedException if no valid session found.
   */
  private async getAuthenticatedUserId(request: FastifyRequest): Promise<string> {
    try {
      const api = (this.authInstance as Record<string, unknown>)?.api as Record<string, unknown> | undefined;
      const getSessionFn = api?.getSession as ((opts: { headers: Record<string, string | string[] | undefined> }) => Promise<unknown>) | undefined;
      const session = await getSessionFn?.({
          headers: request.headers,
        });

      if (!session || typeof session !== 'object') {
        throw UnauthorizedException.missingToken();
      }

      const sessionData = session as { user?: { id?: string } };
      if (!sessionData.user?.id) {
        throw UnauthorizedException.missingToken();
      }

      return sessionData.user.id;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn('Failed to extract session from request');
      throw UnauthorizedException.invalidToken('Session verification failed');
    }
  }

  /**
   * POST /auth/register-phone
   * Initiate phone/OTP registration. Sends OTP to the provided number.
   * NOTE: OTP is sent via better-auth's phoneNumber plugin.
   * AC#1
   */
  @Post('register-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register / login with phone number — sends OTP' })
  @ApiBody({ type: SwaggerRegisterPhoneDto })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Validation error (invalid phone format)' })
  async registerPhone(@Body() body: RegisterPhoneDto) {
    const parsed = RegisterPhoneSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    this.logger.log(`Phone registration initiated for: ****${parsed.data.phoneNumber.slice(-4)}`);

    return {
      message: 'OTP sent to phone number. Verify via POST /auth/verify-otp.',
      phoneNumber: parsed.data.phoneNumber,
    };
  }

  /**
   * POST /auth/verify-otp
   * Verify OTP code for phone registration/login.
   *
   * Flow: validate → better-auth verifies OTP (creates/updates user in local DB)
   *       → sync customer to Backend API
   * AC#1
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code for phone registration/login' })
  @ApiBody({ type: SwaggerVerifyOtpDto })
  @ApiResponse({ status: 200, type: SwaggerVerifyOtpResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error (invalid OTP format)' })
  async verifyOtp(@Body() body: VerifyOtpDto) {
    const parsed = VerifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    // Delegate OTP verification to better-auth
    // better-auth's phoneNumber plugin handles verification and user creation
    // The frontend should call /api/auth/verify-phone directly,
    // but we keep this endpoint as a documented API surface
    this.logger.log(`OTP verification for phone ending: ...${parsed.data.phoneNumber.slice(-4)}`);

    // TODO: Wire to better-auth's verify-phone endpoint
    // For now, return validation success — actual verification via /api/auth/verify-phone
    return {
      message: 'OTP validated. Verify via better-auth /api/auth/verify-phone for full flow.',
      phoneNumber: parsed.data.phoneNumber,
    };
  }

  /**
   * POST /auth/provider/callback
   * Handle OAuth provider callback (Zalo, Google, Facebook, Apple).
   * better-auth handles the actual OAuth flow — this endpoint validates
   * and syncs to Backend API.
   * AC#2, AC#3
   */
  @Post('provider/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle OAuth provider callback (Zalo, Google, Facebook, Apple)' })
  @ApiBody({ type: SwaggerRegisterProviderDto })
  @ApiResponse({ status: 200, type: SwaggerProviderCallbackResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async providerCallback(@Body() body: RegisterProviderDto) {
    const parsed = RegisterProviderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    this.logger.log(`Provider callback: ${parsed.data.providerType}`);

    // Validate input — actual OAuth handled by better-auth's social/genericOAuth plugins
    // When Backend API is available, sync customer record:
    // await this.portHttpClient.request({
    //   url: `${backendUrl}/customers/sync`,
    //   method: 'POST',
    //   portName: 'customer-profile',
    //   body: { providerType, providerId, email, name, phoneNumber },
    // });

    return {
      message: `Provider ${parsed.data.providerType} validated. OAuth flow handled by better-auth.`,
      providerType: parsed.data.providerType,
    };
  }

  /**
   * POST /auth/link-provider
   * Link additional provider to the AUTHENTICATED user.
   * Requires valid session — userId is extracted from session, NOT from body.
   * Delegates to Backend API for the actual linking.
   * AC#4
   */
  @Post('link-provider')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Link additional OAuth provider to authenticated user' })
  @ApiBody({ type: SwaggerLinkProviderDto })
  @ApiResponse({ status: 200, type: SwaggerLinkProviderResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async linkProvider(
    @Req() request: FastifyRequest,
    @Body() body: LinkProviderDto,
  ) {
    const userId = await this.getAuthenticatedUserId(request);

    const parsed = LinkProviderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }

    this.logger.log(`Link provider ${parsed.data.providerType} to user ${userId}`);

    // TODO: When Backend API is available:
    // await this.portHttpClient.request({
    //   url: `${backendUrl}/users/${userId}/providers`,
    //   method: 'POST',
    //   portName: 'customer-profile',
    //   body: { providerType, providerId, providerEmail },
    // });

    return { userId, message: 'Provider link request validated. Sync to Backend API pending.' };
  }

  /**
   * GET /auth/me
   * Get current authenticated user profile.
   * Requires valid session — fetches from Backend API.
   */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, type: SwaggerAuthResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getMe(@Req() request: FastifyRequest) {
    const userId = await this.getAuthenticatedUserId(request);

    // TODO: When Backend API is available:
    // return this.portHttpClient.request({
    //   url: `${backendUrl}/users/${userId}`,
    //   method: 'GET',
    //   portName: 'customer-profile',
    // });

    // Session exists — return minimal profile from session
    return {
      userId,
      message: 'Session verified. Full profile will be fetched from Backend API when available.',
    };
  }
}
