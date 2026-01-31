import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type CloseoutPeriodType = 'day' | 'week' | 'month' | 'custom';

export interface CloseoutRange {
  start: Date;
  end: Date;
  label: string;
  periodType: CloseoutPeriodType;
}

export interface CloseoutSalesBreakdown {
  labor: number;
  parts: number;
  fees: number;
  tax: number;
  discounts: number;
}

export interface CloseoutOperationalFlags {
  openRos: number;
  awaitingApproval: number;
  partsWaiting: number;
}

export interface CloseoutRewardsSummary {
  pointsEarned: number;
  pointsRedeemed: number;
}

export interface CloseoutKpis {
  netSales: number;
  grossProfit: number | null;
  grossProfitPercent: number | null;
  carCount: number;
  averageRepairOrder: number;
  hoursSold: number;
  effectiveLaborRate: number | null;
}

export interface CloseoutRoRow {
  id: string;
  ro_number: string;
  closed_at: string | null;
  customer_name: string | null;
  vehicle_label: string | null;
  labor_total: number;
  parts_total: number;
  fees_total: number;
  tax_total: number;
  grand_total: number;
}

export interface CloseoutPreview {
  period: {
    start: string;
    end: string;
    label: string;
    periodType: CloseoutPeriodType;
  };
  kpis: CloseoutKpis;
  sales: CloseoutSalesBreakdown;
  operational: CloseoutOperationalFlags;
  rewards: CloseoutRewardsSummary;
  payments: Record<string, number>;
  roList: CloseoutRoRow[];
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDayExclusive = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = date.getDate() - day;
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), diff));
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonthExclusive = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 1);

export const getPresetRange = (preset: string, now: Date = new Date()): CloseoutRange => {
  switch (preset) {
    case 'today': {
      const start = startOfDay(now);
      const end = endOfDayExclusive(now);
      return { start, end, label: 'Today', periodType: 'day' };
    }
    case 'yesterday': {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const start = startOfDay(yesterday);
      const end = endOfDayExclusive(yesterday);
      return { start, end, label: 'Yesterday', periodType: 'day' };
    }
    case 'this_week': {
      const start = startOfWeek(now);
      const end = endOfDayExclusive(now);
      return { start, end, label: 'This Week', periodType: 'week' };
    }
    case 'last_week': {
      const thisWeekStart = startOfWeek(now);
      const start = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() - 7);
      const end = thisWeekStart;
      return { start, end, label: 'Last Week', periodType: 'week' };
    }
    case 'this_month': {
      const start = startOfMonth(now);
      const end = endOfMonthExclusive(now);
      return { start, end, label: 'This Month', periodType: 'month' };
    }
    default: {
      const start = startOfDay(now);
      const end = endOfDayExclusive(now);
      return { start, end, label: 'Custom', periodType: 'custom' };
    }
  }
};

export const formatDateRange = (start: Date, end: Date) => {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startLabel = formatter.format(start);
  const endLabel = formatter.format(new Date(end.getTime() - 1));
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

export const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fetchCloseoutPreview = async (range: CloseoutRange, shopId?: string | null) => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.access_token) {
    throw new Error('No active session');
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/closeouts-preview-public`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      label: range.label,
      period_type: range.periodType,
      shop_id: shopId ?? null,
      access_token: sessionData.session.access_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to load closeout preview');
  }

  return (await response.json()) as CloseoutPreview;
};
