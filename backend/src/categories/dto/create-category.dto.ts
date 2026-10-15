import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsOptionalNotNull } from '../../common/validation/optional.decorator.js';
import { SingleLineText } from '../../common/validation/text.decorators.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @SingleLineText()
  name: string;

  @ApiPropertyOptional({ example: 'electronics', description: 'Generated from name when omitted' })
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase latin letters, digits and single hyphens',
  })
  slug?: string;
}
