import { LayoutDashboardIcon, PackageIcon, ReceiptTextIcon, TagsIcon } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { PageLoader } from '@/components/feedback/page-loader';
import { cn } from '@/lib/utils';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptTextIcon, end: false },
  { to: '/admin/products', label: 'Products', icon: PackageIcon, end: false },
  { to: '/admin/categories', label: 'Categories', icon: TagsIcon, end: false },
];

export function AdminLayout() {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="md:w-48 md:shrink-0">
        <p className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Admin
        </p>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col">
          {ADMIN_LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-muted',
                  isActive ? 'bg-muted font-medium' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </section>
    </div>
  );
}
