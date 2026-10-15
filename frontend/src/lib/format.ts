const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}
