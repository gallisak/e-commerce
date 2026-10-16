import { lazy } from 'react';

export const AdminLayout = lazy(() =>
  import('./admin-layout').then((m) => ({ default: m.AdminLayout })),
);
export const DashboardPage = lazy(() =>
  import('./dashboard/pages/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
export const AdminProductsPage = lazy(() =>
  import('./products/pages/admin-products-page').then((m) => ({ default: m.AdminProductsPage })),
);
export const NewProductPage = lazy(() =>
  import('./products/pages/product-editor-page').then((m) => ({ default: m.NewProductPage })),
);
export const EditProductPage = lazy(() =>
  import('./products/pages/product-editor-page').then((m) => ({ default: m.EditProductPage })),
);
export const AdminCategoriesPage = lazy(() =>
  import('./categories/pages/admin-categories-page').then((m) => ({
    default: m.AdminCategoriesPage,
  })),
);
export const AdminOrdersPage = lazy(() =>
  import('./orders/pages/admin-orders-page').then((m) => ({ default: m.AdminOrdersPage })),
);
export const AdminOrderPage = lazy(() =>
  import('./orders/pages/admin-order-page').then((m) => ({ default: m.AdminOrderPage })),
);
