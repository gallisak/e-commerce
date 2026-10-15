import { Loader2Icon } from 'lucide-react';

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground"
    >
      <Loader2Icon className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
