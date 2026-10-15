import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ example: '1 Khreshchatyk St, apt 5, Kyiv' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  @Matches(/^[^\p{Cc}]*$/u, { message: '$property must not contain control characters' })
  shippingAddress: string;
}
