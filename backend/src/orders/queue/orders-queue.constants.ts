export const ORDERS_QUEUE = 'orders';
export const PROCESS_ORDER_JOB = 'process-order';
export const REFUND_ORDER_JOB = 'refund-order';

export interface ProcessOrderJobData {
  orderId: string;
}
