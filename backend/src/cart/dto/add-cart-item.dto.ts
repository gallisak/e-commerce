import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { IsOptionalNotNull } from '../../common/validation/optional.decorator.js';

export const MAX_CART_ITEM_QUANTITY = 99;

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_CART_ITEM_QUANTITY, default: 1 })
  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity: number = 1;
}
