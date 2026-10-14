import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client.js';
import type { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const repository = { findById: vi.fn(), findByEmail: vi.fn(), create: vi.fn() };
  const service = new UsersService(repository as unknown as UsersRepository);

  beforeEach(() => vi.resetAllMocks());

  it('creates customers by default', async () => {
    repository.create.mockResolvedValue({ id: '1' });
    await service.create({ email: 'a@example.com', name: 'A', passwordHash: 'h' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.CUSTOMER }),
    );
  });

  it('maps a unique constraint violation to 409 Conflict', async () => {
    repository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create({ email: 'a@example.com', name: 'A', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws 404 for a missing user', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
