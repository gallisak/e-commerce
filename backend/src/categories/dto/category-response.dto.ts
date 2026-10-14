import { ApiProperty } from '@nestjs/swagger';
import type { Category } from '../../generated/prisma/client.js';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Electronics' })
  name: string;

  @ApiProperty({ example: 'elektronika' })
  slug: string;

  @ApiProperty({ description: 'Number of active (not deleted) products' })
  productsCount: number;

  static fromEntity(category: Category, productsCount: number): CategoryResponseDto {
    return { id: category.id, name: category.name, slug: category.slug, productsCount };
  }
}
