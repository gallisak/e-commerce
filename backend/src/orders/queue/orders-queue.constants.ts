export const ORDERS_QUEUE = 'orders';
export const PROCESS_ORDER_JOB = 'process-order';

export interface ProcessOrderJobData {
  orderId: string;
}
