import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { MockPaymentService } from './payment/mock-payment.service.js';
import { OrderProcessingProcessor } from './queue/order-processing.processor.js';
import { OrderRecoveryService } from './queue/order-recovery.service.js';
import { ORDERS_QUEUE } from './queue/orders-queue.constants.js';
import { OrdersQueueService } from './queue/orders-queue.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: ORDERS_QUEUE })],
  controllers: [OrdersController, AdminOrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    OrdersQueueService,
    OrderProcessingProcessor,
    OrderRecoveryService,
    MockPaymentService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
