import type { DviItemMedia, DviReport, DviReportItem } from '../types/database';

export type RecommendationMediaCounts = {
  photo: number;
  video: number;
  audio: number;
  total: number;
};

export type DviRecommendation = {
  id: string;
  title: string;
  notes: string | null;
  condition: 'red' | 'yellow';
  recommendationStatus: string | null;
  mediaCounts: RecommendationMediaCounts;
  alreadyAdded: boolean;
  reportId: string;
  createdAt: string;
};

export function selectLatestReport(reports: DviReport[]) {
  if (reports.length === 0) return null;
  const published = reports.find((report) => report.status === 'published');
  return published || reports[0];
}

export function buildMediaCounts(media: DviItemMedia[]) {
  return media.reduce<Record<string, RecommendationMediaCounts>>((acc, item) => {
    if (!acc[item.report_item_id]) {
      acc[item.report_item_id] = { photo: 0, video: 0, audio: 0, total: 0 };
    }
    const target = acc[item.report_item_id];
    if (item.media_type === 'photo') target.photo += 1;
    if (item.media_type === 'video') target.video += 1;
    if (item.media_type === 'audio') target.audio += 1;
    target.total += 1;
    return acc;
  }, {});
}

export function buildRecommendations(
  reportId: string,
  items: DviReportItem[],
  mediaCounts: Record<string, RecommendationMediaCounts>,
  existingSourceIds: Set<string>
) {
  const recommendations = items
    .filter((item) => item.condition === 'red' || item.condition === 'yellow')
    .map((item) => ({
      id: item.id,
      title: item.custom_title || item.item_title || item.recommendation || 'Inspection finding',
      notes: item.notes,
      condition: item.condition,
      recommendationStatus: item.recommendation_status || null,
      mediaCounts: mediaCounts[item.id] || { photo: 0, video: 0, audio: 0, total: 0 },
      alreadyAdded: existingSourceIds.has(item.id),
      reportId,
      createdAt: item.created_at,
    }));

  return {
    priority: recommendations.filter((item) => item.condition === 'red'),
    future: recommendations.filter((item) => item.condition === 'yellow'),
  };
}
