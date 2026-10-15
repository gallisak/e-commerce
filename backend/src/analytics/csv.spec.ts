import { escapeCsvField, formatMoney, toCsvRow } from './csv.js';

describe('csv', () => {
  it('quotes fields with separators, quotes and line breaks', () => {
    expect(escapeCsvField('plain')).toBe('plain');
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvField(null)).toBe('');
  });

  it.each(['=HYPERLINK("http://evil")', '+1', '-2+3', '@SUM(A1)', '\tcmd'])(
    'neutralises formula injection in %j',
    (value) => {
      expect(escapeCsvField(value).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('keeps negative numbers as numbers', () => {
    expect(escapeCsvField(-5)).toBe('-5');
  });

  it('builds CRLF-terminated rows and formats kopecks', () => {
    expect(toCsvRow(['a', 1, 'b,c'])).toBe('a,1,"b,c"\r\n');
    expect(formatMoney(129_900)).toBe('1299.00');
    expect(formatMoney(5)).toBe('0.05');
  });
});
