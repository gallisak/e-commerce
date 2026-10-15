import { useAuth } from '@/features/auth/use-auth';

export function AdminDashboardPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {user?.email}.</p>
    </div>
  );
}
