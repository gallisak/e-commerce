import { validateSync } from 'class-validator';
import { MultiLineText, SingleLineText } from './text.decorators.js';

class Sample {
  @SingleLineText()
  title: string;

  @MultiLineText()
  body: string;
}

const errorsFor = (title: string, body: string) => {
  const sample = Object.assign(new Sample(), { title, body });
  return validateSync(sample).map((error) => error.property);
};

describe('text decorators', () => {
  it('accepts ordinary text with unicode punctuation', () => {
    expect(errorsFor('Café «Nova» — 100% <b>', 'Line 1\nLine 2\r\n\tindented')).toEqual([]);
  });

  it('rejects line breaks in single-line text', () => {
    expect(errorsFor('a\nb', 'ok')).toEqual(['title']);
  });

  it('rejects non-whitespace control characters everywhere', () => {
    expect(errorsFor('a\u0000b', 'c\u001bd')).toEqual(['title', 'body']);
  });
});
