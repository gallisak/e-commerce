import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../auth/types/auth-user.js';
import { RolesGuard } from './roles.guard.js';

const contextFor = (user?: AuthUser) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const customer: AuthUser = { id: '1', email: 'c@example.com', role: Role.CUSTOMER };
  const admin: AuthUser = { id: '2', email: 'a@example.com', role: Role.ADMIN };

  afterEach(() => vi.restoreAllMocks());

  it('allows any authenticated user when no roles are required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(customer))).toBe(true);
  });

  it('allows a user with a required role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(contextFor(admin))).toBe(true);
  });

  it('forbids a user without the required role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(customer))).toThrow(ForbiddenException);
  });

  it('forbids when there is no user on the request', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
