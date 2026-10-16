import { activePreset, presetRange, readRange, validateRange } from './range';

const TODAY = '2026-10-16';

describe('dashboard range', () => {
  it('builds inclusive preset ranges ending today', () => {
    expect(presetRange(7, TODAY)).toEqual({ from: '2026-10-10', to: TODAY });
    expect(presetRange(30, TODAY)).toEqual({ from: '2026-09-17', to: TODAY });
  });

  it('detects the active preset', () => {
    expect(activePreset({}, TODAY)).toBe(30);
    expect(activePreset(presetRange(90, TODAY), TODAY)).toBe(90);
    expect(activePreset({ from: '2026-10-01', to: '2026-10-10' }, TODAY)).toBeNull();
  });

  it('reads only valid ranges from the URL', () => {
    const read = (query: string) => readRange(new URLSearchParams(query));
    expect(read('from=2026-10-01&to=2026-10-10')).toEqual({ from: '2026-10-01', to: '2026-10-10' });
    expect(read('from=2026-10-10&to=2026-10-01')).toEqual({});
    expect(read('from=2025-01-01&to=2026-10-01')).toEqual({});
    expect(read('from=2026-10-01')).toEqual({});
    expect(read('from=2026-02-30&to=2026-03-01')).toEqual({});
  });

  it('explains invalid custom ranges', () => {
    expect(validateRange('', '2026-10-01')).toBe('Choose both dates');
    expect(validateRange('2026-10-02', '2026-10-01')).toBe(
      'The start date must not be after the end date',
    );
    expect(validateRange('2025-10-01', '2026-10-02')).toBe('The period must not exceed 366 days');
    expect(validateRange('2025-10-02', '2026-10-02')).toBeNull();
  });
});
