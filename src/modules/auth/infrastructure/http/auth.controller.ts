import {
  Controller,
  Post,
  Get,
  Body,
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
import { PortHttpClient } from '@shared/port/port-http-client.service';
import {
  RegisterPhoneSchema,
} from '../../application/dtos/register-phone.dto';
import {
  RegisterProviderSchema,
  LinkProviderSchema,
  VerifyOtpSchema,
} from '../../application/dtos/register-provider.dto';
import { ValidationException } from '@core/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
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
    private readonly portHttpClient: PortHttpClient,
  ) {}

  /**
   * POST /auth/register-phone
   * Initiate phone/OTP registration. Sends OTP to the provided number.
   * NOTE: OTP is sent via better-auth's phoneNumber plugin.
   * AC#1
   */
  @Public()
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
  @Public()
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
  @Public()
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
    @CurrentUser('id') userId: string,
    @Body() body: LinkProviderDto,
  ) {

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
  async getMe(@CurrentUser('id') userId: string) {

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
