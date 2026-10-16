import { Suspense } from 'react';
import type { RouteObject } from 'react-router';
import { PageLoader } from '@/components/feedback/page-loader';
import { RequireAdmin } from '@/features/auth/components/guards';
import {
  AdminCategoriesPage,
  AdminLayout,
  AdminOrderPage,
  AdminOrdersPage,
  AdminProductsPage,
  DashboardPage,
  EditProductPage,
  NewProductPage,
} from './admin-pages';

export const adminRoute: RouteObject = {
  path: 'admin',
  element: (
    <RequireAdmin>
      <Suspense fallback={<PageLoader label="Loading the admin panel…" />}>
        <AdminLayout />
      </Suspense>
    </RequireAdmin>
  ),
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'orders', element: <AdminOrdersPage /> },
    { path: 'orders/:orderId', element: <AdminOrderPage /> },
    { path: 'products', element: <AdminProductsPage /> },
    { path: 'products/new', element: <NewProductPage /> },
    { path: 'products/:productId/edit', element: <EditProductPage /> },
    { path: 'categories', element: <AdminCategoriesPage /> },
  ],
};
