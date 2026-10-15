import { OrderStatus } from '../generated/prisma/client.js';
import { canTransition, isTerminal } from './order-status.js';

const { NEW, PROCESSING, SHIPPED, COMPLETED, CANCELLED } = OrderStatus;

describe('order status transitions', () => {
  it.each([
    [NEW, PROCESSING],
    [NEW, CANCELLED],
    [PROCESSING, SHIPPED],
    [PROCESSING, CANCELLED],
    [SHIPPED, COMPLETED],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    [NEW, SHIPPED],
    [NEW, COMPLETED],
    [PROCESSING, NEW],
    [SHIPPED, CANCELLED],
    [SHIPPED, PROCESSING],
    [COMPLETED, CANCELLED],
    [CANCELLED, NEW],
    [NEW, NEW],
  ])('forbids %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('treats completed and cancelled as terminal', () => {
    expect([NEW, PROCESSING, SHIPPED, COMPLETED, CANCELLED].filter(isTerminal)).toEqual([
      COMPLETED,
      CANCELLED,
    ]);
  });
});
