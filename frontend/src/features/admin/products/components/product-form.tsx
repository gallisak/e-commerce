import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/button-link';
import { FormError } from '@/components/form/form-error';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { catalogKeys, categoriesQuery } from '@/features/catalog/api';
import { errorMessage } from '@/lib/api/errors';
import type { Product } from '@/lib/api/types';
import { applyServerError } from '@/lib/forms';
import { adminProductsApi, type ProductPayload } from '../api';
import { toKopecks, toPriceInput } from '../price';
import { isUploadedImage, type ProductFormValues, productSchema } from '../schemas';
import { ImageField } from './image-field';

const SERVER_FIELDS = ['name', 'description', 'price', 'stock', 'categoryId'] as const;

function defaultValues(product?: Product): ProductFormValues {
  const imageUrl = product?.imageUrl ?? null;
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? toPriceInput(product.price) : '',
    stock: product ? String(product.stock) : '',
    categoryId: product?.category.id ?? '',
    image: {
      source: !imageUrl ? 'file' : isUploadedImage(imageUrl) ? 'file' : 'url',
      url: imageUrl && !isUploadedImage(imageUrl) ? imageUrl : '',
      file: null,
      current: imageUrl,
    },
  };
}

function toPayload(values: ProductFormValues): ProductPayload {
  const payload: ProductPayload = {
    name: values.name,
    description: values.description,
    price: toKopecks(values.price),
    stock: Number(values.stock),
    categoryId: values.categoryId,
  };
  if (values.image.source === 'url') payload.imageUrl = values.image.url;
  if (values.image.source === 'none') payload.imageUrl = null;
  return payload;
}

export function ProductForm({ product }: { product?: Product }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useQuery(categoriesQuery());
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultValues(product),
  });

  const onSubmit = handleSubmit(async (values) => {
    let saved: Product;
    try {
      saved = product
        ? await adminProductsApi.update(product.id, toPayload(values))
        : await adminProductsApi.create(toPayload(values));
    } catch (error) {
      applyServerError(error, setError, SERVER_FIELDS);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: catalogKeys.all });

    const file = values.image.source === 'file' ? values.image.file : null;
    if (file) {
      try {
        await adminProductsApi.uploadImage(saved.id, file);
        await queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      } catch (error) {
        const message = errorMessage(error);
        toast.error(`“${saved.name}” was saved, but the image was not uploaded: ${message}`);
        if (product) {
          setError('image.file', { message });
        } else {
          navigate(`/admin/products/${saved.id}/edit`, { replace: true });
        }
        return;
      }
    }

    toast.success(product ? `“${saved.name}” updated` : `“${saved.name}” created`);
    navigate('/admin/products');
  });

  const categoryItems =
    categories.data?.map((category) => ({ value: category.id, label: category.name })) ??
    (product ? [{ value: product.category.id, label: product.category.name }] : []);

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-2xl">
      <FieldGroup>
        <FormError message={errors.root?.server?.message} />
        <TextField
          id="product-name"
          label="Name"
          registration={register('name')}
          error={errors.name}
        />
        <Field data-invalid={errors.description ? true : undefined}>
          <FieldLabel htmlFor="product-description">Description</FieldLabel>
          <Textarea
            id="product-description"
            rows={5}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? 'product-description-error' : undefined}
            {...register('description')}
          />
          <FieldError
            id="product-description-error"
            errors={errors.description ? [errors.description] : undefined}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="product-price"
            label="Price, ₴"
            inputMode="decimal"
            placeholder="599.00"
            registration={register('price')}
            error={errors.price}
          />
          <TextField
            id="product-stock"
            label="Stock"
            inputMode="numeric"
            placeholder="0"
            registration={register('stock')}
            error={errors.stock}
          />
        </div>
        <Controller
          control={control}
          name="categoryId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.error ? true : undefined}>
              <FieldLabel id="product-category-label">Category</FieldLabel>
              <Select
                items={categoryItems}
                value={field.value || null}
                onValueChange={(value) => field.onChange(value ?? '')}
              >
                <SelectTrigger
                  aria-labelledby="product-category-label"
                  aria-invalid={fieldState.error ? true : undefined}
                  aria-describedby={fieldState.error ? 'product-category-error' : undefined}
                  className="w-full sm:w-72"
                  onBlur={field.onBlur}
                >
                  <SelectValue
                    placeholder={categories.isPending ? 'Loading categories…' : 'Choose a category'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                id="product-category-error"
                errors={fieldState.error ? [fieldState.error] : undefined}
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="image"
          render={({ field }) => (
            <ImageField value={field.value} onChange={field.onChange} errors={errors.image} />
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </Button>
          <ButtonLink variant="ghost" to="/admin/products">
            Cancel
          </ButtonLink>
        </div>
      </FieldGroup>
    </form>
  );
}
