import type { RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/app-layout';
import { AccountPage } from '@/features/account/pages/account-page';
import { adminRoute } from '@/features/admin/admin-routes';
import { GuestOnly, RequireAuth } from '@/features/auth/components/guards';
import { CartPage } from '@/features/cart/pages/cart-page';
import { LoginPage } from '@/features/auth/pages/login-page';
import { RegisterPage } from '@/features/auth/pages/register-page';
import { CatalogPage } from '@/features/catalog/pages/catalog-page';
import { ProductPage } from '@/features/catalog/pages/product-page';
import { CheckoutPage } from '@/features/orders/pages/checkout-page';
import { OrderPage } from '@/features/orders/pages/order-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { RouteErrorPage } from '@/pages/route-error-page';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <CatalogPage /> },
      { path: 'products/:productId', element: <ProductPage /> },
      {
        path: 'login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        path: 'register',
        element: (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        ),
      },
      {
        path: 'cart',
        element: (
          <RequireAuth>
            <CartPage />
          </RequireAuth>
        ),
      },
      {
        path: 'checkout',
        element: (
          <RequireAuth>
            <CheckoutPage />
          </RequireAuth>
        ),
      },
      {
        path: 'account',
        element: (
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        ),
      },
      {
        path: 'account/orders/:orderId',
        element: (
          <RequireAuth>
            <OrderPage />
          </RequireAuth>
        ),
      },
      adminRoute,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
