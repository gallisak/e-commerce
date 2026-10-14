import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service.js';
import { slugify } from '../common/utils/slugify.js';
import { Prisma } from '../generated/prisma/client.js';
import { CategoriesRepository, type CategoryWithCount } from './categories.repository.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly cache: CatalogCacheService,
  ) {}

  async findAll(): Promise<CategoryResponseDto[]> {
    const { value } = await this.cache.getOrSet('categories', {}, async () =>
      (await this.categoriesRepository.findAll()).map(toDto),
    );
    return value;
  }

  async findOne(id: string): Promise<CategoryResponseDto> {
    return toDto(await this.getOrThrow(id));
  }

  async ensureExists(id: string): Promise<void> {
    if (!(await this.categoriesRepository.exists(id))) {
      throw new BadRequestException('Category does not exist');
    }
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.withUniqueCheck(() =>
      this.categoriesRepository.create({
        name: dto.name,
        slug: this.resolveSlug(dto.slug, dto.name),
      }),
    );
    this.logger.log(`Category created: ${category.id} (${category.slug})`);
    await this.cache.invalidate('category created');
    return toDto(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    await this.getOrThrow(id);
    const category = await this.withUniqueCheck(() =>
      this.categoriesRepository.update(id, {
        name: dto.name,
        slug: dto.slug ?? (dto.name ? this.resolveSlug(undefined, dto.name) : undefined),
      }),
    );
    this.logger.log(`Category updated: ${category.id}`);
    await this.cache.invalidate('category updated');
    return toDto(category);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    if ((await this.categoriesRepository.countAllProducts(id)) > 0) {
      throw new ConflictException('Category has products and cannot be deleted');
    }
    try {
      await this.categoriesRepository.delete(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Category has products and cannot be deleted');
      }
      throw error;
    }
    this.logger.log(`Category deleted: ${id}`);
    await this.cache.invalidate('category deleted');
  }

  private async getOrThrow(id: string): Promise<CategoryWithCount> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private resolveSlug(slug: string | undefined, name: string): string {
    const resolved = slug ?? slugify(name);
    if (!resolved)
      throw new BadRequestException('Cannot generate slug from name, provide it explicitly');
    return resolved;
  }

  private async withUniqueCheck<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Category with this name or slug already exists');
      }
      throw error;
    }
  }
}

function toDto(category: CategoryWithCount): CategoryResponseDto {
  return CategoryResponseDto.fromEntity(category, category._count.products);
}
