import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { pageItems } from '@/lib/pagination';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  label?: string;
}

export function Pagination({ page, totalPages, hrefFor, label = 'Pagination' }: PaginationProps) {
  if (totalPages <= 1) return null;
  const linkClass = buttonVariants({ variant: 'ghost', size: 'sm' });
  const disabledClass = cn(linkClass, 'pointer-events-none opacity-50');

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} className={linkClass} rel="prev">
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </span>
      )}
      <ul className="flex items-center gap-1">
        {pageItems(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} className="px-1 text-muted-foreground" aria-hidden>
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                to={hrefFor(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  buttonVariants({ variant: item === page ? 'outline' : 'ghost', size: 'sm' }),
                  'min-w-8 tabular-nums',
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ul>
      {page < totalPages ? (
        <Link to={hrefFor(page + 1)} className={linkClass} rel="next">
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </span>
      )}
    </nav>
  );
}
