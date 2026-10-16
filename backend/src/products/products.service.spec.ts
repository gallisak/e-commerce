import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CatalogCacheService } from '../catalog-cache/catalog-cache.service.js';
import type { CategoriesService } from '../categories/categories.service.js';
import type { ImageStorageService } from '../storage/image-storage.service.js';
import { ProductQueryDto, ProductSort } from './dto/product-query.dto.js';
import type { ProductsRepository, ProductWithCategory } from './products.repository.js';
import { escapeLikePattern, ProductsService } from './products.service.js';

const category = {
  id: 'cat-1',
  name: 'Books',
  slug: 'books',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeProduct = (overrides: Partial<ProductWithCategory> = {}): ProductWithCategory => ({
  id: 'p-1',
  name: 'Clean Code',
  description: '',
  price: 59900,
  stock: 5,
  imageUrl: null,
  categoryId: category.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  category,
  ...overrides,
});

const query = (overrides: Partial<ProductQueryDto> = {}): ProductQueryDto =>
  Object.assign(new ProductQueryDto(), overrides);

describe('ProductsService', () => {
  let repository: Record<keyof ProductsRepository, ReturnType<typeof vi.fn>>;
  let categories: { ensureExists: ReturnType<typeof vi.fn> };
  let storage: {
    saveProductImage: ReturnType<typeof vi.fn>;
    removeIfLocal: ReturnType<typeof vi.fn>;
  };
  let cache: { getOrSet: ReturnType<typeof vi.fn>; invalidate: ReturnType<typeof vi.fn> };
  let service: ProductsService;

  beforeEach(() => {
    repository = {
      search: vi.fn().mockResolvedValue([[makeProduct()], 1]),
      findActiveById: vi.fn().mockResolvedValue(makeProduct()),
      create: vi.fn().mockResolvedValue(makeProduct()),
      update: vi.fn().mockResolvedValue(makeProduct()),
      softDelete: vi.fn(),
    };
    categories = { ensureExists: vi.fn() };
    storage = {
      saveProductImage: vi.fn().mockResolvedValue('/uploads/products/new.png'),
      removeIfLocal: vi.fn(),
    };
    cache = {
      getOrSet: vi.fn(async (_scope: string, _params: unknown, loader: () => Promise<unknown>) => ({
        value: await loader(),
        hit: false,
      })),
      invalidate: vi.fn(),
    };
    service = new ProductsService(
      repository as unknown as ProductsRepository,
      categories as unknown as CategoriesService,
      storage as unknown as ImageStorageService,
      cache as unknown as CatalogCacheService,
    );
  });

  describe('findAll', () => {
    it('applies search, category, price range, sorting and pagination', async () => {
      const { value } = await service.findAll(
        query({
          page: 2,
          limit: 10,
          search: '50%_off',
          categoryId: category.id,
          minPrice: 100,
          maxPrice: 900,
          sort: ProductSort.PriceDesc,
        }),
      );

      expect(repository.search).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          categoryId: category.id,
          name: { contains: '50\\%\\_off', mode: 'insensitive' },
          price: { gte: 100, lte: 900 },
        },
        orderBy: [{ price: 'desc' }, { id: 'asc' }],
        skip: 10,
        take: 10,
      });
      expect(value.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    });

    it('lists only active products sorted by newest by default', async () => {
      await service.findAll(query());
      expect(repository.search).toHaveBeenCalledWith({
        where: { deletedAt: null, categoryId: undefined, name: undefined, price: undefined },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 0,
        take: 12,
      });
    });

    it('rejects an inverted price range', () => {
      expect(() => service.findAll(query({ minPrice: 500, maxPrice: 100 }))).toThrow(
        BadRequestException,
      );
      expect(repository.search).not.toHaveBeenCalled();
    });
  });

  it('throws 404 for a missing or deleted product', async () => {
    repository.findActiveById.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates the category and invalidates the cache on create', async () => {
    await service.create({ name: 'New', price: 100, stock: 1, categoryId: category.id });

    expect(categories.ensureExists).toHaveBeenCalledWith(category.id);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: '', imageUrl: null }),
    );
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('does not create a product in a non-existent category', async () => {
    categories.ensureExists.mockRejectedValue(new BadRequestException('Category does not exist'));
    await expect(
      service.create({ name: 'New', price: 100, stock: 1, categoryId: 'missing' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('removes the previous uploaded image when the image URL changes', async () => {
    repository.findActiveById.mockResolvedValue(
      makeProduct({ imageUrl: '/uploads/products/old.png' }),
    );
    await service.update('p-1', { imageUrl: 'https://cdn.example.com/new.png' });

    expect(storage.removeIfLocal).toHaveBeenCalledWith('/uploads/products/old.png');
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('keeps the image when other fields change', async () => {
    await service.update('p-1', { stock: 10 });
    expect(storage.removeIfLocal).not.toHaveBeenCalled();
  });

  it('requires a file for image upload', async () => {
    await expect(service.uploadImage('p-1', undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the uploaded image and replaces the old one', async () => {
    repository.findActiveById.mockResolvedValue(
      makeProduct({ imageUrl: '/uploads/products/old.png' }),
    );
    await service.uploadImage('p-1', { buffer: Buffer.from('img') } as Express.Multer.File);

    expect(repository.update).toHaveBeenCalledWith('p-1', {
      imageUrl: '/uploads/products/new.png',
    });
    expect(storage.removeIfLocal).toHaveBeenCalledWith('/uploads/products/old.png');
  });

  it('removes the new file when the product update fails', async () => {
    repository.update.mockRejectedValue(new Error('database is down'));

    await expect(
      service.uploadImage('p-1', { buffer: Buffer.from('img') } as Express.Multer.File),
    ).rejects.toThrow('database is down');
    expect(storage.removeIfLocal).toHaveBeenCalledWith('/uploads/products/new.png');
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('soft-deletes and invalidates the cache', async () => {
    await service.remove('p-1');
    expect(repository.softDelete).toHaveBeenCalledWith('p-1');
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100%_\\x')).toBe('100\\%\\_\\\\x');
  });
});
