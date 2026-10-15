const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsvRow(values: (string | number | null | undefined)[]): string {
  return `${values.map(escapeCsvField).join(',')}\r\n`;
}

export function formatMoney(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}
