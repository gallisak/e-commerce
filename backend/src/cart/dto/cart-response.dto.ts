import { ApiProperty } from '@nestjs/swagger';

export enum CartItemIssue {
  OutOfStock = 'OUT_OF_STOCK',
  InsufficientStock = 'INSUFFICIENT_STOCK',
}

export class CartItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Current price in kopecks' })
  price: number;

  @ApiProperty({ type: String, nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: 'Units currently available in stock' })
  stock: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ description: 'price * quantity, in kopecks' })
  lineTotal: number;

  @ApiProperty({ enum: CartItemIssue, enumName: 'CartItemIssue', nullable: true })
  issue: CartItemIssue | null;
}

export class CartResponseDto {
  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty()
  totalQuantity: number;

  @ApiProperty({ description: 'In kopecks' })
  totalAmount: number;

  @ApiProperty({ description: 'True when some items cannot be ordered in the requested quantity' })
  hasIssues: boolean;
}
