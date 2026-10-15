import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { SingleLineText } from '../../common/validation/text.decorators.js';

export class CheckoutDto {
  @ApiProperty({ example: '1 Khreshchatyk St, apt 5, Kyiv' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  @SingleLineText()
  shippingAddress: string;
}
