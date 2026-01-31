import { describe, expect, it } from 'vitest';
import { buildCustomReportItem, buildReportItems, summarizeReportItems } from '../dvi';

describe('buildReportItems', () => {
  it('maps template sections into report item inserts', () => {
    const items = buildReportItems('report-1', {
      sections: [
        {
          items: [
            { id: 'item-1', default_recommendation: 'Check brakes' } as any,
            { id: 'item-2', default_recommendation: null } as any,
          ],
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      report_id: 'report-1',
      template_item_id: 'item-1',
      condition: 'green',
      recommendation: 'Check brakes',
    });
    expect(items[1].recommendation).toBeNull();
  });

  it('builds a custom report item insert payload', () => {
    const payload = buildCustomReportItem({
      reportId: 'report-2',
      title: 'Custom battery check',
      sectionTitle: 'Electrical',
      sortOrder: 4,
    });

    expect(payload).toEqual({
      report_id: 'report-2',
      condition: 'green',
      is_custom: true,
      custom_title: 'Custom battery check',
      custom_section: 'Electrical',
      sort_order: 4,
    });
  });

  it('summarizes report item conditions', () => {
    const summary = summarizeReportItems([
      { condition: 'green' },
      { condition: 'yellow' },
      { condition: 'red' },
      { condition: 'yellow' },
    ]);

    expect(summary).toEqual({ green: 1, yellow: 2, red: 1 });
  });
});
