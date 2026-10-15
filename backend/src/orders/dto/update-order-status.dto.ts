import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client.js';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Comment for the status history; used as cancel reason' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(500)
  @Matches(/^[^\p{Cc}]*$/u, { message: '$property must not contain control characters' })
  note?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Changed my mind' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(500)
  @Matches(/^[^\p{Cc}]*$/u, { message: '$property must not contain control characters' })
  reason?: string;
}
