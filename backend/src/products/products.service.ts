import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type CacheResult, CatalogCacheService } from '../catalog-cache/catalog-cache.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ImageStorageService } from '../storage/image-storage.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import { type ProductQueryDto, ProductSort } from './dto/product-query.dto.js';
import { type ProductListResponseDto, ProductResponseDto } from './dto/product-response.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsRepository, type ProductWithCategory } from './products.repository.js';

const SORT_ORDER: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  [ProductSort.Newest]: [{ createdAt: 'desc' }, { id: 'asc' }],
  [ProductSort.PriceAsc]: [{ price: 'asc' }, { id: 'asc' }],
  [ProductSort.PriceDesc]: [{ price: 'desc' }, { id: 'asc' }],
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly imageStorage: ImageStorageService,
    private readonly cache: CatalogCacheService,
  ) {}

  findAll(query: ProductQueryDto): Promise<CacheResult<ProductListResponseDto>> {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice must be less than or equal to maxPrice');
    }

    const params = {
      page: query.page,
      limit: query.limit,
      search: query.search,
      categoryId: query.categoryId,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sort: query.sort,
    };

    return this.cache.getOrSet('products:list', params, async () => {
      const [products, total] = await this.productsRepository.search({
        where: {
          deletedAt: null,
          categoryId: params.categoryId,
          name: params.search
            ? { contains: escapeLikePattern(params.search), mode: 'insensitive' }
            : undefined,
          price:
            params.minPrice !== undefined || params.maxPrice !== undefined
              ? { gte: params.minPrice, lte: params.maxPrice }
              : undefined,
        },
        orderBy: SORT_ORDER[params.sort],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      });
      return {
        items: products.map((product) => ProductResponseDto.fromEntity(product)),
        meta: PaginationMetaDto.of(params.page, params.limit, total),
      };
    });
  }

  findOne(id: string): Promise<CacheResult<ProductResponseDto>> {
    return this.cache.getOrSet('products:item', { id }, async () =>
      ProductResponseDto.fromEntity(await this.getOrThrow(id)),
    );
  }

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    await this.categoriesService.ensureExists(dto.categoryId);
    const product = await this.productsRepository.create({
      name: dto.name,
      description: dto.description ?? '',
      price: dto.price,
      stock: dto.stock,
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl ?? null,
    });
    this.logger.log(`Product created: ${product.id} "${product.name}" stock=${product.stock}`);
    await this.cache.invalidate('product created');
    return ProductResponseDto.fromEntity(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const existing = await this.getOrThrow(id);
    if (dto.categoryId) await this.categoriesService.ensureExists(dto.categoryId);

    const product = await this.productsRepository.update(id, {
      name: dto.name,
      description: dto.description,
      price: dto.price,
      stock: dto.stock,
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl,
    });
    if (dto.imageUrl !== undefined && dto.imageUrl !== existing.imageUrl) {
      await this.imageStorage.removeIfLocal(existing.imageUrl);
    }
    this.logger.log(`Product updated: ${id} fields=[${Object.keys(dto).join(', ')}]`);
    await this.cache.invalidate('product updated');
    return ProductResponseDto.fromEntity(product);
  }

  async uploadImage(
    id: string,
    file: Express.Multer.File | undefined,
  ): Promise<ProductResponseDto> {
    if (!file) throw new BadRequestException('Image file is required (multipart field "file")');
    const existing = await this.getOrThrow(id);

    const imageUrl = await this.imageStorage.saveProductImage(file.buffer);
    let product: ProductWithCategory;
    try {
      product = await this.productsRepository.update(id, { imageUrl });
    } catch (error) {
      await this.imageStorage.removeIfLocal(imageUrl);
      throw error;
    }
    await this.imageStorage.removeIfLocal(existing.imageUrl);

    this.logger.log(`Product image uploaded: ${id} -> ${imageUrl}`);
    await this.cache.invalidate('product image uploaded');
    return ProductResponseDto.fromEntity(product);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.productsRepository.softDelete(id);
    this.logger.log(`Product deleted (soft): ${id}`);
    await this.cache.invalidate('product deleted');
  }

  private async getOrThrow(id: string): Promise<ProductWithCategory> {
    const product = await this.productsRepository.findActiveById(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
