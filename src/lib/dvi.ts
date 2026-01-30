import type { DviTemplateItem } from '../types/database';

type TemplateSection = {
  items: DviTemplateItem[];
};

type TemplateWithSections = {
  sections: TemplateSection[];
};

export function buildReportItems(reportId: string, template: TemplateWithSections | null) {
  if (!template) return [];
  return template.sections.flatMap((section) =>
    section.items.map((item) => ({
      report_id: reportId,
      template_item_id: item.id,
      condition: 'green' as const,
      item_title: item.title,
      recommendation: item.default_recommendation || null,
    }))
  );
}

export function buildCustomReportItem(payload: {
  reportId: string;
  title: string;
  sectionTitle: string;
  sortOrder?: number;
}) {
  return {
    report_id: payload.reportId,
    condition: 'green' as const,
    is_custom: true,
    custom_title: payload.title,
    custom_section: payload.sectionTitle,
    sort_order: payload.sortOrder ?? 0,
  };
}

export function summarizeReportItems(items: Array<{ condition: 'green' | 'yellow' | 'red' }>) {
  return items.reduce(
    (acc, item) => {
      acc[item.condition] += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 }
  );
}
