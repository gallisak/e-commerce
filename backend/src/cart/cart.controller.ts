import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { CartResponseDto } from './dto/cart-response.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@ApiTags('cart')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOkResponse({ type: CartResponseDto })
  getCart(@CurrentUser() user: AuthUser): Promise<CartResponseDto> {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CartResponseDto, description: 'Adds to the existing quantity' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'Not enough stock; body contains `available`' })
  addItem(@CurrentUser() user: AuthUser, @Body() dto: AddCartItemDto): Promise<CartResponseDto> {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:productId')
  @ApiOkResponse({ type: CartResponseDto, description: 'Sets the quantity' })
  @ApiNotFoundResponse({ description: 'Product not found or not in the cart' })
  @ApiConflictResponse({ description: 'Not enough stock; body contains `available`' })
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItem(user.id, productId, dto.quantity);
  }

  @Delete('items/:productId')
  @ApiOkResponse({ type: CartResponseDto, description: 'Idempotent' })
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeItem(user.id, productId);
  }

  @Delete()
  @ApiOkResponse({ type: CartResponseDto })
  clear(@CurrentUser() user: AuthUser): Promise<CartResponseDto> {
    return this.cartService.clear(user.id);
  }
}
