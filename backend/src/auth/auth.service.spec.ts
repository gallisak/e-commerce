import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Role, type RefreshToken, type User } from '../generated/prisma/client.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { RefreshTokenRepository } from './refresh-token.repository.js';
import type { IssuedTokens, TokenService } from './token.service.js';

vi.mock('argon2', () => ({
  hash: vi.fn(async (value: string) => `hashed:${value}`),
  verify: vi.fn(async (hash: string, value: string) => hash === `hashed:${value}`),
}));

const user: User = {
  id: 'user-1',
  email: 'jane@example.com',
  name: 'Jane',
  passwordHash: 'hashed:Secret123',
  role: Role.CUSTOMER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const issued: IssuedTokens = {
  accessToken: 'access',
  accessTokenTtl: 900,
  refreshToken: 'new-refresh',
  refreshTokenId: 'rt-new',
  refreshTokenExpiresAt: new Date(Date.now() + 60_000),
};

const storedToken = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
  id: 'rt-1',
  userId: user.id,
  tokenHash: 'aa',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let tokenService: {
    issue: ReturnType<typeof vi.fn>;
    verifyRefreshToken: ReturnType<typeof vi.fn>;
    hash: ReturnType<typeof vi.fn>;
  };
  let refreshTokens: Record<keyof RefreshTokenRepository, ReturnType<typeof vi.fn>>;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    usersService = {
      findByEmail: vi.fn(),
      getById: vi.fn().mockResolvedValue(user),
      create: vi.fn().mockResolvedValue(user),
    };
    tokenService = {
      issue: vi.fn().mockResolvedValue(issued),
      verifyRefreshToken: vi.fn().mockResolvedValue({ sub: user.id, jti: 'rt-1' }),
      hash: vi.fn((token: string) => (token === 'valid-refresh' ? 'aa' : 'bb')),
    };
    refreshTokens = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(storedToken()),
      revokeIfActive: vi.fn().mockResolvedValue(true),
      revokeAllForUser: vi.fn().mockResolvedValue(2),
      deleteExpiredForUser: vi.fn(),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      tokenService as unknown as TokenService,
      refreshTokens as unknown as RefreshTokenRepository,
    );
  });

  describe('register', () => {
    it('hashes the password, creates the user and persists a refresh token hash', async () => {
      const session = await service.register({
        email: user.email,
        name: 'Jane',
        password: 'Secret123',
      });

      expect(usersService.create).toHaveBeenCalledWith({
        email: user.email,
        name: 'Jane',
        passwordHash: 'hashed:Secret123',
      });
      expect(refreshTokens.create).toHaveBeenCalledWith({
        id: issued.refreshTokenId,
        userId: user.id,
        tokenHash: 'bb',
        expiresAt: issued.refreshTokenExpiresAt,
      });
      expect(session).toEqual({ user, tokens: issued });
    });

    it('propagates conflict when the email is taken', async () => {
      usersService.create.mockRejectedValue(new ConflictException());
      await expect(
        service.register({ email: user.email, name: 'Jane', password: 'Secret123' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tokenService.issue).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a session for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      await expect(service.login({ email: user.email, password: 'Secret123' })).resolves.toEqual({
        user,
        tokens: issued,
      });
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      await expect(service.login({ email: user.email, password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(tokenService.issue).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with the same error and still runs password verification', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'Secret123' }),
      ).rejects.toThrow('Invalid email or password');
      expect(argon2.verify).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('rotates a valid token: revokes the old one and issues a new session', async () => {
      const session = await service.refresh('valid-refresh');

      expect(refreshTokens.revokeIfActive).toHaveBeenCalledWith('rt-1');
      expect(refreshTokens.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'rt-new' }));
      expect(session.tokens).toBe(issued);
    });

    it('rejects a missing token', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token with an invalid signature', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(null);
      await expect(service.refresh('forged')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokens.findById).not.toHaveBeenCalled();
    });

    it('rejects a token whose hash does not match the stored one', async () => {
      await expect(service.refresh('other-token')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokens.revokeIfActive).not.toHaveBeenCalled();
    });

    it('rejects a token that was not issued for the user in the payload', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue({ sub: 'someone-else', jti: 'rt-1' });
      await expect(service.refresh('valid-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('revokes every session of the user when a revoked token is reused', async () => {
      refreshTokens.findById.mockResolvedValue(storedToken({ revokedAt: new Date() }));

      await expect(service.refresh('valid-refresh')).rejects.toThrow(
        'Refresh token has been revoked',
      );
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(user.id);
      expect(tokenService.issue).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      refreshTokens.findById.mockResolvedValue(
        storedToken({ expiresAt: new Date(Date.now() - 1) }),
      );
      await expect(service.refresh('valid-refresh')).rejects.toThrow('Refresh token has expired');
    });

    it('rejects when a concurrent request already rotated the token', async () => {
      refreshTokens.revokeIfActive.mockResolvedValue(false);
      await expect(service.refresh('valid-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenService.issue).not.toHaveBeenCalled();
    });

    it('rejects when the user no longer exists', async () => {
      usersService.getById.mockRejectedValue(new NotFoundException());
      await expect(service.refresh('valid-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the presented refresh token', async () => {
      await service.logout('valid-refresh');
      expect(refreshTokens.revokeIfActive).toHaveBeenCalledWith('rt-1');
    });

    it('is a no-op without a token or with an invalid one', async () => {
      await service.logout(undefined);
      tokenService.verifyRefreshToken.mockResolvedValue(null);
      await service.logout('garbage');
      expect(refreshTokens.revokeIfActive).not.toHaveBeenCalled();
    });
  });
});
