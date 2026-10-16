import { z } from 'zod';

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .regex(/^[^\p{Cc}]*$/u, 'Name must be on one line'),
  slug: z
    .string()
    .trim()
    .max(100, 'Slug must be at most 100 characters')
    .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, 'Use lowercase latin letters, digits and hyphens'),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export function toCategoryPayload(values: CategoryFormValues) {
  return { name: values.name, slug: values.slug || undefined };
}
