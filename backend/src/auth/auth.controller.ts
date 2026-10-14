import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { LoginRateLimit } from '../common/decorators/login-rate-limit.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH } from './auth.constants.js';
import { type AuthSession, AuthService } from './auth.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Post('register')
  @LoginRateLimit()
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @ApiTooManyRequestsResponse()
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithSession(await this.authService.register(dto), res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LoginRateLimit()
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiTooManyRequestsResponse()
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithSession(await this.authService.login(dto), res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOkResponse({ type: AuthResponseDto, description: 'Rotates the refresh token cookie' })
  @ApiUnauthorizedResponse()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    try {
      return this.respondWithSession(
        await this.authService.refresh(this.readRefreshToken(req)),
        res,
      );
    } catch (error) {
      this.clearRefreshCookie(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiNoContentResponse()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(this.readRefreshToken(req));
    this.clearRefreshCookie(res);
  }

  private respondWithSession({ user, tokens }: AuthSession, res: Response): AuthResponseDto {
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(),
      expires: tokens.refreshTokenExpiresAt,
    });
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.accessTokenTtl,
      user: UserResponseDto.fromEntity(user),
    };
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'strict' as const,
      path: REFRESH_TOKEN_COOKIE_PATH,
    };
  }

  private readRefreshToken(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
