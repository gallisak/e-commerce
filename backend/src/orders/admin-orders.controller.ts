import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AdminOrderQueryDto } from './dto/order-query.dto.js';
import { OrderDetailDto, OrderListResponseDto } from './dto/order-response.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('admin / orders')
@ApiBearerAuth()
@ApiForbiddenResponse()
@Roles(Role.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOkResponse({ type: OrderListResponseDto })
  findAll(@Query() query: AdminOrderQueryDto): Promise<OrderListResponseDto> {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderDetailDto> {
    return this.ordersService.findById(id);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description:
      'Transition not allowed from the current status; PROCESSING is set only by the payment worker',
  })
  changeStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderDetailDto> {
    return this.ordersService.changeStatusByAdmin(admin, id, dto.status, dto.note);
  }
}
