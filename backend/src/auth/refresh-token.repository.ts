import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { RefreshToken } from '../generated/prisma/client.js';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Pick<RefreshToken, 'id' | 'userId' | 'tokenHash' | 'expiresAt'>,
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  async revokeIfActive(id: string): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  async deleteExpiredForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  }
}
