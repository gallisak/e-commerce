import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { profileQuery } from '@/features/auth/api';
import { OrderHistory } from '@/features/orders/components/order-history';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

export function AccountPage() {
  useDocumentTitle('My account');
  const profile = useQuery(profileQuery());

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
        {profile.isPending && <Skeleton className="h-36 w-full max-w-md" />}
        {profile.isError && (
          <ErrorState
            error={profile.error}
            title="Could not load your profile"
            onRetry={() => profile.refetch()}
          />
        )}
        {profile.data && (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {profile.data.name}
                {profile.data.role === 'ADMIN' && <Badge variant="secondary">Admin</Badge>}
              </CardTitle>
              <CardDescription>{profile.data.email}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Member since {formatDate(profile.data.createdAt)}
            </CardContent>
          </Card>
        )}
      </div>
      <OrderHistory />
    </div>
  );
}
