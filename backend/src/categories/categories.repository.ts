import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Category, Prisma } from '../generated/prisma/client.js';

export type CategoryWithCount = Category & { _count: { products: number } };

const activeProductsCount = {
  _count: { select: { products: { where: { deletedAt: null } } } },
} as const;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<CategoryWithCount[]> {
    return this.prisma.category.findMany({
      include: activeProductsCount,
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string): Promise<CategoryWithCount | null> {
    return this.prisma.category.findUnique({ where: { id }, include: activeProductsCount });
  }

  exists(id: string): Promise<boolean> {
    return this.prisma.category.count({ where: { id } }).then((count) => count > 0);
  }

  create(data: Prisma.CategoryCreateInput): Promise<CategoryWithCount> {
    return this.prisma.category.create({ data, include: activeProductsCount });
  }

  update(id: string, data: Prisma.CategoryUpdateInput): Promise<CategoryWithCount> {
    return this.prisma.category.update({ where: { id }, data, include: activeProductsCount });
  }

  countAllProducts(id: string): Promise<number> {
    return this.prisma.product.count({ where: { categoryId: id } });
  }

  delete(id: string): Promise<Category> {
    return this.prisma.category.delete({ where: { id } });
  }
}
