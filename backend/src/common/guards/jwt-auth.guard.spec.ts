import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../generated/prisma/client.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'test-secret-test-secret-test-secret';

const contextFor = (request: Record<string, unknown>) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRET });
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(reflector, jwt);

  afterEach(() => vi.restoreAllMocks());

  it('skips verification for public routes', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
  });

  it('attaches the user for a valid bearer token', async () => {
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@example.com', role: Role.ADMIN });
    const request: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', email: 'a@example.com', role: Role.ADMIN });
  });

  it('rejects a request without a token', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const token = await new JwtService({ secret: 'another-secret-another-secret-123' }).signAsync({
      sub: 'u1',
    });
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const token = await jwt.signAsync({ sub: 'u1' }, { expiresIn: -1 });
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
