import { ImageOffIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}

export function ProductImage({ src, alt, className, eager = false }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && failedSrc !== src;

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <div
          role={alt ? 'img' : undefined}
          aria-label={alt ? `${alt} (no image)` : undefined}
          aria-hidden={alt ? undefined : true}
          className="flex size-full items-center justify-center text-muted-foreground"
        >
          <ImageOffIcon className="size-8" aria-hidden />
        </div>
      )}
    </div>
  );
}
