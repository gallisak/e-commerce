import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Category, Prisma, Product } from '../generated/prisma/client.js';

export type ProductWithCategory = Product & { category: Category };

export interface ProductSearchParams {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput[];
  skip: number;
  take: number;
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search({
    where,
    orderBy,
    skip,
    take,
  }: ProductSearchParams): Promise<[ProductWithCategory[], number]> {
    return this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy, skip, take, include: { category: true } }),
      this.prisma.product.count({ where }),
    ]);
  }

  findActiveById(id: string): Promise<ProductWithCategory | null> {
    return this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    });
  }

  create(data: Prisma.ProductUncheckedCreateInput): Promise<ProductWithCategory> {
    return this.prisma.product.create({ data, include: { category: true } });
  }

  update(id: string, data: Prisma.ProductUncheckedUpdateInput): Promise<ProductWithCategory> {
    return this.prisma.product.update({ where: { id }, data, include: { category: true } });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.cartItem.deleteMany({ where: { productId: id } }),
    ]);
  }
}
