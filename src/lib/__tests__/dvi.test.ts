import { describe, expect, it } from 'vitest';
import { buildReportItems } from '../dvi';

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
});
