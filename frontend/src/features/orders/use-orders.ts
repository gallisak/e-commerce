import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cartKeys } from '@/features/cart/api';
import { EMPTY_CART } from '@/features/cart/cart-math';
import { catalogKeys } from '@/features/catalog/api';
import type { OrderDetail } from '@/lib/api/types';
import { orderKeys, ordersApi } from './api';

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shippingAddress,
      idempotencyKey,
    }: {
      shippingAddress: string;
      idempotencyKey: string;
    }) => ordersApi.checkout(shippingAddress, idempotencyKey),
    onSuccess: (order) => {
      queryClient.setQueryData(cartKeys.all, EMPTY_CART);
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => ordersApi.cancel(orderId, reason),
    onSuccess: (order: OrderDetail) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
}
