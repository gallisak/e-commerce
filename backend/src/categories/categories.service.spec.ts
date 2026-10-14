import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { CatalogCacheService } from '../catalog-cache/catalog-cache.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CategoriesRepository, CategoryWithCount } from './categories.repository.js';
import { CategoriesService } from './categories.service.js';

const category: CategoryWithCount = {
  id: 'cat-1',
  name: 'Books',
  slug: 'books',
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { products: 3 },
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('CategoriesService', () => {
  let repository: Record<keyof CategoriesRepository, ReturnType<typeof vi.fn>>;
  let cache: { getOrSet: ReturnType<typeof vi.fn>; invalidate: ReturnType<typeof vi.fn> };
  let service: CategoriesService;

  beforeEach(() => {
    repository = {
      findAll: vi.fn().mockResolvedValue([category]),
      findById: vi.fn().mockResolvedValue(category),
      exists: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockResolvedValue(category),
      update: vi.fn().mockResolvedValue(category),
      countAllProducts: vi.fn().mockResolvedValue(0),
      delete: vi.fn(),
    };
    cache = {
      getOrSet: vi.fn(async (_s: string, _p: unknown, loader: () => Promise<unknown>) => ({
        value: await loader(),
        hit: false,
      })),
      invalidate: vi.fn(),
    };
    service = new CategoriesService(
      repository as unknown as CategoriesRepository,
      cache as unknown as CatalogCacheService,
    );
  });

  it('returns categories with active product counts', async () => {
    await expect(service.findAll()).resolves.toEqual([
      { id: 'cat-1', name: 'Books', slug: 'books', productsCount: 3 },
    ]);
  });

  it('generates a slug from the name when none is provided', async () => {
    await service.create({ name: 'Home & Kitchen' });
    expect(repository.create).toHaveBeenCalledWith({
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
    });
    expect(cache.invalidate).toHaveBeenCalled();
  });

  it('uses an explicit slug', async () => {
    await service.create({ name: 'Books', slug: 'books' });
    expect(repository.create).toHaveBeenCalledWith({ name: 'Books', slug: 'books' });
  });

  it('rejects a name that produces an empty slug', async () => {
    await expect(service.create({ name: '!!!' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate name or slug to 409', async () => {
    repository.create.mockRejectedValue(uniqueViolation());
    await expect(service.create({ name: 'Books' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('regenerates the slug on rename', async () => {
    await service.update('cat-1', { name: 'Electronics' });
    expect(repository.update).toHaveBeenCalledWith('cat-1', {
      name: 'Electronics',
      slug: 'electronics',
    });
  });

  it('returns 404 when updating a missing category', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to delete a category that still has products', async () => {
    repository.countAllProducts.mockResolvedValue(2);
    await expect(service.remove('cat-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty category and invalidates the cache', async () => {
    await service.remove('cat-1');
    expect(repository.delete).toHaveBeenCalledWith('cat-1');
    expect(cache.invalidate).toHaveBeenCalled();
  });

  it('ensureExists rejects unknown categories with 400', async () => {
    repository.exists.mockResolvedValue(false);
    await expect(service.ensureExists('missing')).rejects.toBeInstanceOf(BadRequestException);
  });
});
