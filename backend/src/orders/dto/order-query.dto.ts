import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { DATE_ONLY_PATTERN } from '../../common/utils/dates.js';
import { OrderStatus } from '../../generated/prisma/client.js';

export class OrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class AdminOrderQueryDto extends OrderQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Created on or after this day (inclusive, store time zone)',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'from must be a date in YYYY-MM-DD format' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Created before this day (exclusive, store time zone)',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'to must be a date in YYYY-MM-DD format' })
  to?: string;
}
