import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/use-auth';
import { errorMessage } from '@/lib/api/errors';
import type { Cart } from '@/lib/api/types';
import { cartApi, cartKeys, cartQuery } from './api';
import {
  addToCart,
  type CartProduct,
  EMPTY_CART,
  removeFromCart,
  setCartQuantity,
} from './cart-math';

export type CartChange = (
  | { type: 'add'; product: CartProduct; quantity: number }
  | { type: 'update'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
) & { onApplied?: () => void };

function applyChange(cart: Cart, change: CartChange): Cart {
  switch (change.type) {
    case 'add':
      return addToCart(cart, change.product, change.quantity);
    case 'update':
      return setCartQuantity(cart, change.productId, change.quantity);
    case 'remove':
      return removeFromCart(cart, change.productId);
    case 'clear':
      return EMPTY_CART;
  }
}

function sendChange(change: CartChange): Promise<Cart> {
  switch (change.type) {
    case 'add':
      return cartApi.addItem(change.product.id, change.quantity);
    case 'update':
      return cartApi.updateItem(change.productId, change.quantity);
    case 'remove':
      return cartApi.removeItem(change.productId);
    case 'clear':
      return cartApi.clear();
  }
}

export function useCart() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    ...cartQuery(),
    enabled: status === 'authenticated',
    refetchOnWindowFocus: () => queryClient.isMutating({ mutationKey: cartKeys.all }) === 0,
  });
}

export function useCartSyncing(): boolean {
  return useIsMutating({ mutationKey: cartKeys.all }) > 0;
}

export function useCartMutation() {
  const queryClient = useQueryClient();
  const isLastPending = () => queryClient.isMutating({ mutationKey: cartKeys.all }) === 1;

  return useMutation({
    mutationKey: cartKeys.all,
    scope: { id: 'cart' },
    mutationFn: sendChange,
    onMutate: async (change: CartChange) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.all });
      const previous = queryClient.getQueryData<Cart>(cartKeys.all);
      queryClient.setQueryData<Cart>(cartKeys.all, applyChange(previous ?? EMPTY_CART, change));
      return { previous };
    },
    onSuccess: async (cart, change) => {
      change.onApplied?.();
      if (!isLastPending()) return;
      await queryClient.cancelQueries({ queryKey: cartKeys.all });
      queryClient.setQueryData(cartKeys.all, cart);
    },
    onError: (error, _change, context) => {
      toast.error(errorMessage(error));
      if (!isLastPending()) return;
      if (context?.previous) queryClient.setQueryData(cartKeys.all, context.previous);
      void queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}
