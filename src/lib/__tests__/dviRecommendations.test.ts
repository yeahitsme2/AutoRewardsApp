import { describe, expect, it } from 'vitest';
import { buildMediaCounts, buildRecommendations, selectLatestReport } from '../dviRecommendations';

describe('selectLatestReport', () => {
  it('prefers published report when present', () => {
    const report = selectLatestReport([
      { id: '1', status: 'draft', created_at: '2024-01-01' } as any,
      { id: '2', status: 'published', created_at: '2024-01-02' } as any,
    ]);
    expect(report?.id).toBe('2');
  });

  it('falls back to latest when no published reports', () => {
    const report = selectLatestReport([
      { id: '1', status: 'draft', created_at: '2024-01-03' } as any,
    ]);
    expect(report?.id).toBe('1');
  });
});

describe('buildMediaCounts', () => {
  it('counts media types per report item', () => {
    const counts = buildMediaCounts([
      { report_item_id: 'a', media_type: 'photo' } as any,
      { report_item_id: 'a', media_type: 'video' } as any,
      { report_item_id: 'b', media_type: 'audio' } as any,
      { report_item_id: 'a', media_type: 'photo' } as any,
    ]);
    expect(counts.a).toEqual({ photo: 2, video: 1, audio: 0, total: 3 });
    expect(counts.b).toEqual({ photo: 0, video: 0, audio: 1, total: 1 });
  });
});

describe('buildRecommendations', () => {
  it('groups red and yellow items and flags duplicates', () => {
    const result = buildRecommendations(
      'report-1',
      [
        { id: '1', condition: 'red', created_at: '2024-01-01', recommendation: null } as any,
        { id: '2', condition: 'yellow', created_at: '2024-01-01', recommendation: null } as any,
        { id: '3', condition: 'green', created_at: '2024-01-01', recommendation: null } as any,
      ],
      {},
      new Set(['2'])
    );
    expect(result.priority).toHaveLength(1);
    expect(result.future).toHaveLength(1);
    expect(result.future[0].alreadyAdded).toBe(true);
  });
});
