import { z } from 'zod';
import { isUuid } from '@/lib/ids';
import { isPriceInput, MAX_PRICE_KOPECKS, toKopecks } from './price';

export const MAX_STOCK = 1_000_000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SINGLE_LINE = /^[^\p{Cc}]*$/u;
const MULTI_LINE = /^(?:[^\p{Cc}]|[\t\n\r])*$/u;

export type ImageSource = 'file' | 'url' | 'none';

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isUploadedImage(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith('/uploads/'));
}

export const productSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(200, 'Name must be at most 200 characters')
      .regex(SINGLE_LINE, 'Name must be on one line'),
    description: z
      .string()
      .trim()
      .max(5000, 'Description must be at most 5000 characters')
      .regex(MULTI_LINE, 'Description contains unsupported characters'),
    price: z
      .string()
      .trim()
      .min(1, 'Price is required')
      .refine(isPriceInput, 'Enter a price like 599 or 599.99')
      .refine((value) => !isPriceInput(value) || toKopecks(value) <= MAX_PRICE_KOPECKS, {
        message: 'Price must be at most ₴1,000,000',
      }),
    stock: z
      .string()
      .trim()
      .min(1, 'Stock is required')
      .regex(/^\d+$/, 'Stock must be a whole number')
      .refine((value) => Number(value) <= MAX_STOCK, 'Stock must be at most 1,000,000'),
    categoryId: z.string().refine(isUuid, 'Choose a category'),
    image: z.object({
      source: z.enum(['file', 'url', 'none']),
      url: z.string().trim(),
      file: z.instanceof(File).nullable(),
      current: z.string().nullable(),
    }),
  })
  .superRefine(({ image }, ctx) => {
    if (image.source === 'url') {
      if (!image.url) {
        ctx.addIssue({ code: 'custom', path: ['image', 'url'], message: 'Enter an image URL' });
      } else if (image.url.length > 2048 || !isHttpsUrl(image.url)) {
        ctx.addIssue({
          code: 'custom',
          path: ['image', 'url'],
          message: 'Enter a valid https:// URL',
        });
      }
    }
    if (image.source === 'file') {
      if (!image.file) {
        if (!isUploadedImage(image.current)) {
          ctx.addIssue({
            code: 'custom',
            path: ['image', 'file'],
            message: 'Choose an image file',
          });
        }
      } else if (!IMAGE_TYPES.includes(image.file.type)) {
        ctx.addIssue({
          code: 'custom',
          path: ['image', 'file'],
          message: 'Only JPEG, PNG and WebP images are allowed',
        });
      } else if (image.file.size > MAX_IMAGE_BYTES) {
        ctx.addIssue({
          code: 'custom',
          path: ['image', 'file'],
          message: 'The image must be at most 5 MB',
        });
      }
    }
  });

export type ProductFormValues = z.infer<typeof productSchema>;
