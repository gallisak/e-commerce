const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'UAH',
  currencyDisplay: 'narrowSymbol',
});

export function formatPrice(kopecks: number): string {
  return priceFormatter.format(kopecks / 100);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}
