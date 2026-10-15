import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const SEARCH_DEBOUNCE_MS = 350;

interface SearchBoxProps {
  value: string;
  onSearch: (value: string) => void;
}

export function SearchBox({ value, onSearch }: SearchBoxProps) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitted = useRef(value);

  useEffect(() => {
    if (value === submitted.current) return;
    submitted.current = value;
    clearTimeout(timer.current);
    setDraft(value);
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = (next: string) => {
    clearTimeout(timer.current);
    submitted.current = next.trim();
    onSearch(submitted.current);
  };

  const schedule = (next: string) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => submit(next), SEARCH_DEBOUNCE_MS);
  };

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        submit(draft);
      }}
    >
      <label htmlFor="catalog-search" className="sr-only">
        Search products
      </label>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="catalog-search"
        type="search"
        placeholder="Search products…"
        autoComplete="off"
        maxLength={100}
        value={draft}
        onChange={(event) => schedule(event.target.value)}
        className="pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          onClick={() => {
            setDraft('');
            submit('');
          }}
        >
          <XIcon />
        </Button>
      )}
    </form>
  );
}
