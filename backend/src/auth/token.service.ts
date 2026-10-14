import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { User } from '../generated/prisma/client.js';
import type { AccessTokenPayload, RefreshTokenPayload } from './types/auth-user.js';

export interface IssuedTokens {
  accessToken: string;
  accessTokenTtl: number;
  refreshToken: string;
  refreshTokenId: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get refreshTokenTtl(): number {
    return this.config.get('JWT_REFRESH_TTL_SECONDS', { infer: true });
  }

  async issue(user: Pick<User, 'id' | 'email' | 'role'>): Promise<IssuedTokens> {
    const accessTokenTtl = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const refreshTokenId = randomUUID();

    const accessPayload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti: refreshTokenId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: accessTokenTtl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.refreshTokenTtl,
      }),
    ]);

    return {
      accessToken,
      accessTokenTtl,
      refreshToken,
      refreshTokenId,
      refreshTokenExpiresAt: new Date(Date.now() + this.refreshTokenTtl * 1000),
    };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      return null;
    }
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
