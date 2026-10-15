import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { DATE_ONLY_PATTERN } from '../../common/utils/dates.js';

export class DateRangeQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-15',
    description: 'Start date (inclusive, store time zone). Default: 30 days before "to"',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'from must be a date in YYYY-MM-DD format' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-16',
    description: 'End date (exclusive, store time zone). Default: tomorrow',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'to must be a date in YYYY-MM-DD format' })
  to?: string;
}

export class SummaryQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 20,
    default: 5,
    description: 'Size of the top products list',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  top: number = 5;
}
