import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenRepository } from './refresh-token.repository.js';
import { type IssuedTokens, TokenService } from './token.service.js';

export interface AuthSession {
  user: User;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash: await argon2.hash(dto.password),
    });
    this.logger.log(`User registered: ${user.id}`);
    return this.startSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordValid = user
      ? await argon2.verify(user.passwordHash, dto.password)
      : await this.verifyAgainstDummy(dto.password);

    if (!user || !passwordValid) {
      this.logger.warn(`Failed login attempt for ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`User logged in: ${user.id}`);
    return this.startSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthSession> {
    const payload = refreshToken ? await this.tokenService.verifyRefreshToken(refreshToken) : null;
    if (!refreshToken || !payload) throw new UnauthorizedException('Invalid refresh token');

    const stored = await this.refreshTokens.findById(payload.jti);
    if (
      !stored ||
      stored.userId !== payload.sub ||
      !this.hashMatches(stored.tokenHash, refreshToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      const revoked = await this.refreshTokens.revokeAllForUser(stored.userId);
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}; revoked ${revoked} active session(s)`,
      );
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (!(await this.refreshTokens.revokeIfActive(stored.id))) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.usersService.getById(stored.userId).catch(() => {
      throw new UnauthorizedException('Invalid refresh token');
    });
    return this.startSession(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload) return;

    const stored = await this.refreshTokens.findById(payload.jti);
    if (stored && this.hashMatches(stored.tokenHash, refreshToken)) {
      await this.refreshTokens.revokeIfActive(stored.id);
      this.logger.log(`User logged out: ${stored.userId}`);
    }
  }

  private async startSession(user: User): Promise<AuthSession> {
    const tokens = await this.tokenService.issue(user);
    await this.refreshTokens.create({
      id: tokens.refreshTokenId,
      userId: user.id,
      tokenHash: this.tokenService.hash(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiresAt,
    });
    await this.refreshTokens.deleteExpiredForUser(user.id);
    return { user, tokens };
  }

  private hashMatches(storedHash: string, token: string): boolean {
    const expected = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(this.tokenService.hash(token), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= argon2.hash('dummy-password-for-timing-equalization');
    await argon2.verify(await this.dummyHash, password);
    return false;
  }
}
