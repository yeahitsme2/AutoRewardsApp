import { describe, expect, it } from 'vitest';
import { formatDateRange, getPresetRange } from '../closeouts';

describe('closeout ranges', () => {
  it('builds today range with exclusive end', () => {
    const base = new Date('2026-01-31T10:15:00');
    const range = getPresetRange('today', base);
    expect(range.start.toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(range.end.toISOString().slice(0, 10)).toBe('2026-02-01');
  });

  it('builds last week range', () => {
    const base = new Date('2026-01-31T10:15:00');
    const range = getPresetRange('last_week', base);
    const diff = Math.round((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
    expect(diff).toBe(7);
  });

  it('formats inclusive range labels', () => {
    const start = new Date('2026-01-31T00:00:00');
    const end = new Date('2026-02-01T00:00:00');
    expect(formatDateRange(start, end)).toContain('Jan');
  });
});
