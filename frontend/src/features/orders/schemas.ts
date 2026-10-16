import { z } from 'zod';

const SINGLE_LINE = /^[^\p{Cc}]*$/u;

export const checkoutSchema = z.object({
  shippingAddress: z
    .string()
    .trim()
    .min(5, 'Enter the full shipping address (at least 5 characters)')
    .max(500, 'Shipping address must be at most 500 characters')
    .regex(SINGLE_LINE, 'Shipping address must be on one line'),
});

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, 'Reason must be at most 500 characters')
    .regex(SINGLE_LINE, 'Reason must be on one line'),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;
