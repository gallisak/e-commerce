export type Role = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  productsCount: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  createdAt: string;
  updatedAt: string;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc';

export type CartItemIssue = 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number;
  quantity: number;
  lineTotal: number;
  issue: CartItemIssue | null;
}

export interface Cart {
  items: CartItem[];
  totalQuantity: number;
  totalAmount: number;
  hasIssues: boolean;
}

export type OrderStatus = 'NEW' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

export interface OrderCustomer {
  id: string;
  email: string;
  name: string;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  itemsCount: number;
  customer: OrderCustomer;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusChange {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  byUser: boolean;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  shippingAddress: string;
  cancelReason: string | null;
  customer: OrderCustomer;
  items: OrderItem[];
  statusHistory: OrderStatusChange[];
  createdAt: string;
  updatedAt: string;
}

export interface StockShortage {
  productId: string;
  name: string;
  requested: number;
  available: number;
}
