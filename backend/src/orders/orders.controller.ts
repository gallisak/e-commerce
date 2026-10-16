import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { OrderDetailDto, OrderListResponseDto } from './dto/order-response.dto.js';
import { CancelOrderDto } from './dto/update-order-status.dto.js';
import { OrdersService } from './orders.service.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

@ApiTags('orders')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Repeated requests with the same key return the original order',
  })
  @ApiCreatedResponse({ type: OrderDetailDto, description: 'Order placed, stock reserved' })
  @ApiOkResponse({ type: OrderDetailDto, description: 'Replay of an already placed order' })
  @ApiBadRequestResponse({ description: 'Empty cart or invalid payload' })
  @ApiConflictResponse({ description: 'Insufficient stock; body lists affected items' })
  @ApiUnprocessableEntityResponse({
    description: 'Idempotency-Key was already used with a different payload',
  })
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDetailDto> {
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException(
        'Idempotency-Key must be 8-100 characters: letters, digits, - or _',
      );
    }
    const { order, replayed } = await this.ordersService.checkout(user, dto, idempotencyKey);
    if (replayed) {
      res.status(HttpStatus.OK);
      res.setHeader('Idempotent-Replayed', 'true');
    }
    return order;
  }

  @Get()
  @ApiOkResponse({ type: OrderListResponseDto })
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: OrderQueryDto,
  ): Promise<OrderListResponseDto> {
    return this.ordersService.findMine(user.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiNotFoundResponse({ description: 'Order does not exist or belongs to another user' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetailDto> {
    return this.ordersService.findMineById(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OrderDetailDto, description: 'Order cancelled, stock released' })
  @ApiNotFoundResponse({ description: 'Order does not exist or belongs to another user' })
  @ApiConflictResponse({ description: 'Order can no longer be cancelled' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderDetailDto> {
    return this.ordersService.cancelByCustomer(user, id, dto.reason);
  }
}
