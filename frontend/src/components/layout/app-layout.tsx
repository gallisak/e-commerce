import { Outlet, ScrollRestoration } from 'react-router';
import { SiteHeader } from './site-header';

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Mini Marketplace · demo store
      </footer>
      <ScrollRestoration />
    </div>
  );
}
