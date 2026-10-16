import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, TagsIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { catalogKeys, categoriesQuery } from '@/features/catalog/api';
import { errorMessage } from '@/lib/api/errors';
import type { Category } from '@/lib/api/types';
import { pluralize } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { adminCategoriesApi } from '../api';
import { CategoryForm } from '../components/category-form';
import { toCategoryPayload } from '../schemas';

export function AdminCategoriesPage() {
  useDocumentTitle('Categories');
  const queryClient = useQueryClient();
  const categories = useQuery({ ...categoriesQuery(), staleTime: 0 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKeys.all });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      <Card>
        <CardHeader>
          <CardTitle>New category</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            idPrefix="new-category"
            submitLabel="Add category"
            slugHint="Used in catalog links. Leave empty to generate it."
            onSubmit={async (values) => {
              const created = await adminCategoriesApi.create(toCategoryPayload(values));
              toast.success(`Category “${created.name}” created`);
              await refresh();
            }}
          />
        </CardContent>
      </Card>

      {categories.isError && !categories.data ? (
        <ErrorState
          error={categories.error}
          title="Could not load categories"
          onRetry={() => categories.refetch()}
        />
      ) : !categories.data ? (
        <div role="status" aria-label="Loading categories" className="space-y-2">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-14 w-full" />
          ))}
        </div>
      ) : categories.data.length === 0 ? (
        <EmptyState
          icon={TagsIcon}
          title="No categories yet"
          description="Add the first one above."
        />
      ) : (
        <ul aria-label="Categories" className="divide-y rounded-xl border">
          {categories.data.map((category) => (
            <CategoryRow key={category.id} category={category} onChanged={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  onChanged,
}: {
  category: Category;
  onChanged: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li aria-label={category.name} className="px-4 py-3">
        <CategoryForm
          idPrefix={`edit-${category.id}`}
          defaultValues={{ name: category.name, slug: category.slug }}
          submitLabel="Save"
          slugHint="Changing the slug breaks old catalog links."
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            const updated = await adminCategoriesApi.update(category.id, {
              name: values.name,
              slug: values.slug || category.slug,
            });
            toast.success(`Category “${updated.name}” saved`);
            await onChanged();
            setEditing(false);
          }}
        />
      </li>
    );
  }

  const remove = async () => {
    try {
      await adminCategoriesApi.remove(category.id);
      toast.success(`Category “${category.name}” deleted`);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  return (
    <li aria-label={category.name} className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{category.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          /{category.slug} · {pluralize(category.productsCount, 'product')}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${category.name}`}
        onClick={() => setEditing(true)}
      >
        <PencilIcon />
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`}>
            <Trash2Icon />
          </Button>
        }
        title={`Delete “${category.name}”?`}
        description={
          category.productsCount > 0
            ? 'This category still has products. Move or delete them first, otherwise the deletion will be rejected.'
            : 'The category will be removed from the catalog.'
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={remove}
      />
    </li>
  );
}
