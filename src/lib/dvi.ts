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
      recommendation: item.default_recommendation || null,
    }))
  );
}
