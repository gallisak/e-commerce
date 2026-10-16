import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsOptionalNotNull } from '../../common/validation/optional.decorator.js';
import { MultiLineText, SingleLineText } from '../../common/validation/text.decorators.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const MAX_PRICE = 100_000_000;
export const MAX_STOCK = 1_000_000;

export class CreateProductDto {
  @ApiProperty({ example: 'Nova X Smartphone' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @SingleLineText()
  name: string;

  @ApiPropertyOptional({ example: 'AMOLED 6.5", 128 GB', default: '' })
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  @MultiLineText()
  description?: string;

  @ApiProperty({ description: 'Price in kopecks (1 UAH = 100)', example: 1899900 })
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price: number;

  @ApiProperty({ example: 25 })
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    example: 'https://picsum.photos/seed/phone/600/600',
    nullable: true,
    description: 'External image URL; use POST /products/:id/image to upload a file instead',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;
}
