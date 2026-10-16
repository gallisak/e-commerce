import { TrophyIcon } from 'lucide-react';
import { Link } from 'react-router';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPrice } from '@/lib/format';
import type { TopProduct } from '../api';

export function TopProducts({ products }: { products: TopProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <TrophyIcon className="size-6" aria-hidden />
        No sales in this period.
      </div>
    );
  }

  return (
    <Table aria-label="Top products">
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product, index) => (
          <TableRow key={product.productId}>
            <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
            <TableCell className="max-w-48 whitespace-normal">
              <Link
                to={`/admin/products/${product.productId}/edit`}
                className="font-medium hover:underline"
              >
                {product.name}
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{product.quantity}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPrice(product.revenue)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
