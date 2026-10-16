import { useEffect, useRef, useState } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductImage } from '@/features/catalog/components/product-image';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  IMAGE_TYPES,
  type ImageSource,
  isHttpsUrl,
  isUploadedImage,
  type ProductFormValues,
} from '../schemas';

type ImageValue = ProductFormValues['image'];

const URL_PREVIEW_DELAY_MS = 400;

function isPreviewableUrl(url: string): boolean {
  return isHttpsUrl(url) && new URL(url).hostname.includes('.');
}

interface ImageFieldProps {
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  errors?: FieldErrors<ImageValue>;
}

export function ImageField({ value, onChange, errors }: ImageFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const selectFile = (file: File | null) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = file ? URL.createObjectURL(file) : null;
    setSelected(file && objectUrl.current ? { file, url: objectUrl.current } : null);
    onChange({ ...value, source: 'file', file });
  };

  const filePreview = selected && selected.file === value.file ? selected.url : null;
  const typedUrl = useDebouncedValue(value.url.trim(), URL_PREVIEW_DELAY_MS);
  const urlPreview = isPreviewableUrl(typedUrl) ? typedUrl : null;

  const preview =
    value.source === 'file'
      ? (filePreview ?? (isUploadedImage(value.current) ? value.current : null))
      : value.source === 'url'
        ? urlPreview
        : null;

  const urlError = errors?.url?.message;
  const fileError = errors?.file?.message;

  return (
    <Field>
      <FieldLabel id="product-image-label">Image</FieldLabel>
      <div className="flex flex-col gap-4 sm:flex-row">
        <ProductImage
          src={preview}
          alt="Image preview"
          className="size-32 shrink-0 rounded-lg border"
        />
        <Tabs
          aria-labelledby="product-image-label"
          value={value.source}
          onValueChange={(source) => onChange({ ...value, source: source as ImageSource })}
          className="min-w-0 flex-1"
        >
          <TabsList>
            <TabsTrigger value="file">Upload</TabsTrigger>
            <TabsTrigger value="url">Link</TabsTrigger>
            <TabsTrigger value="none">No image</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="space-y-2">
            <Field data-invalid={fileError ? true : undefined}>
              <FieldLabel htmlFor="product-image-file" className="sr-only">
                Image file
              </FieldLabel>
              <input
                ref={fileInput}
                id="product-image-file"
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="sr-only"
                aria-invalid={fileError ? true : undefined}
                aria-describedby="product-image-file-hint product-image-file-error"
                onChange={(event) => {
                  selectFile(event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                  {value.file || isUploadedImage(value.current)
                    ? 'Choose another file'
                    : 'Choose a file'}
                </Button>
                {value.file && (
                  <span className="max-w-full truncate text-sm text-muted-foreground">
                    {value.file.name}
                  </span>
                )}
              </div>
              <FieldDescription id="product-image-file-hint">
                JPEG, PNG or WebP, up to 5 MB.
              </FieldDescription>
              <FieldError
                id="product-image-file-error"
                errors={fileError ? [{ message: fileError }] : undefined}
              />
            </Field>
          </TabsContent>
          <TabsContent value="url">
            <Field data-invalid={urlError ? true : undefined}>
              <FieldLabel htmlFor="product-image-url" className="sr-only">
                Image URL
              </FieldLabel>
              <Input
                id="product-image-url"
                type="url"
                inputMode="url"
                placeholder="https://example.com/image.jpg"
                value={value.url}
                aria-invalid={urlError ? true : undefined}
                aria-describedby="product-image-url-error"
                onChange={(event) => onChange({ ...value, url: event.target.value })}
              />
              <FieldError
                id="product-image-url-error"
                errors={urlError ? [{ message: urlError }] : undefined}
              />
            </Field>
          </TabsContent>
          <TabsContent value="none">
            <p className="text-muted-foreground">The product will be shown with a placeholder.</p>
          </TabsContent>
        </Tabs>
      </div>
    </Field>
  );
}
