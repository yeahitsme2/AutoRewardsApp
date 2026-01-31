import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBrand } from '../lib/BrandContext';
import { useAuth } from '../lib/AuthContext';
import {
  CloseoutPreview,
  CloseoutRange,
  getPresetRange,
  formatDateRange,
  fetchCloseoutPreview,
  toDateInputValue,
} from '../lib/closeouts';
import {
  TrendingUp,
  Users,
  Gift,
  DollarSign,
  Calendar,
  Award,
  UserPlus,
  Activity,
  ArrowUpRight,
  X,
  Download,
  Printer,
  Save
} from 'lucide-react';
import type { CloseoutSnapshot } from '../types/database';

interface InsightsData {
  totalCustomers: number;
  newSignups30Days: number;
  newSignups7Days: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  totalLifetimeRevenue: number;
  averagePointsPerCustomer: number;
  customersWithAccounts: number;
  walkInCustomers: number;
  totalServicesCompleted: number;
  revenueThisMonth: number;
  revenueLast30Days: number;
  topTierDistribution: { tier: string; count: number }[];
  dailySignups: { date: string; count: number }[];
}

export function Insights() {
  const { brandSettings } = useBrand();
  const { admin, superAdmin } = useAuth();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeoutOpen, setCloseoutOpen] = useState(false);
  const [closeoutLoading, setCloseoutLoading] = useState(false);
  const [closeoutError, setCloseoutError] = useState<string | null>(null);
  const [closeoutPreview, setCloseoutPreview] = useState<CloseoutPreview | null>(null);
  const [closeoutRange, setCloseoutRange] = useState<CloseoutRange | null>(null);
  const [closeoutSnapshots, setCloseoutSnapshots] = useState<CloseoutSnapshot[]>([]);
  const [activeSnapshot, setActiveSnapshot] = useState<CloseoutSnapshot | null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [finalizingSnapshot, setFinalizingSnapshot] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  useEffect(() => {
    loadCloseoutSnapshots();
  }, [admin?.shop_id, superAdmin?.id]);

  const loadInsights = async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*');

      if (customersError) throw customersError;

      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, amount, created_at, points_earned');

      if (servicesError) throw servicesError;

      const { data: redemptions, error: redemptionsError } = await supabase
        .from('reward_redemptions')
        .select('points_spent');

      if (redemptionsError) throw redemptionsError;

      const totalCustomers = customers?.length || 0;
      const newSignups30Days = customers?.filter(c =>
        new Date(c.created_at) >= thirtyDaysAgo
      ).length || 0;
      const newSignups7Days = customers?.filter(c =>
        new Date(c.created_at) >= sevenDaysAgo
      ).length || 0;

      const totalPointsEarned = services?.reduce((sum, s) => sum + (s.points_earned || 0), 0) || 0;
      const totalPointsRedeemed = redemptions?.reduce((sum, r) => sum + (r.points_spent || 0), 0) || 0;
      const totalLifetimeRevenue = customers?.reduce((sum, c) => {
        const lifetime = (c as any).lifetime_spending ?? (c as any).total_lifetime_spending ?? (c as any).total_spent ?? 0;
        return sum + Number(lifetime || 0);
      }, 0) || 0;
      const averagePointsPerCustomer = totalCustomers > 0
        ? Math.round(customers!.reduce((sum, c) => sum + (c.reward_points || 0), 0) / totalCustomers)
        : 0;

      const customersWithAccounts = customers?.filter(c => c.has_account).length || 0;
      const walkInCustomers = customers?.filter(c => !c.has_account).length || 0;
      const totalServicesCompleted = services?.length || 0;

      const revenueThisMonth = services?.filter(s =>
        new Date(s.created_at) >= startOfMonth
      ).reduce((sum, s) => sum + Number(s.amount || 0), 0) || 0;

      const revenueLast30Days = services?.filter(s =>
        new Date(s.created_at) >= thirtyDaysAgo
      ).reduce((sum, s) => sum + Number(s.amount || 0), 0) || 0;

      const tierCounts: Record<string, number> = {};
      customers?.forEach(c => {
        const tier = c.tier || 'bronze';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });
      const topTierDistribution = Object.entries(tierCounts).map(([tier, count]) => ({ tier, count }));

      const dailySignupsMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailySignupsMap[dateStr] = 0;
      }
      customers?.forEach(c => {
        const dateStr = new Date(c.created_at).toISOString().split('T')[0];
        if (dailySignupsMap[dateStr] !== undefined) {
          dailySignupsMap[dateStr]++;
        }
      });
      const dailySignups = Object.entries(dailySignupsMap).map(([date, count]) => ({ date, count }));

      setInsights({
        totalCustomers,
        newSignups30Days,
        newSignups7Days,
        totalPointsEarned,
        totalPointsRedeemed,
        totalLifetimeRevenue,
        averagePointsPerCustomer,
        customersWithAccounts,
        walkInCustomers,
        totalServicesCompleted,
        revenueThisMonth,
        revenueLast30Days,
        topTierDistribution,
        dailySignups
      });
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCloseoutSnapshots = async () => {
    if (!admin?.shop_id && !superAdmin?.id) return;
    const { data, error } = await supabase
      .from('closeout_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) {
      console.error('Error loading closeout snapshots:', error);
      return;
    }
    setCloseoutSnapshots(data || []);
  };

  const openCloseoutPreview = async (preset: string) => {
    const range = getPresetRange(preset);
    setCloseoutRange(range);
    setCustomStart(toDateInputValue(range.start));
    setCustomEnd(toDateInputValue(new Date(range.end.getTime() - 1)));
    setActiveSnapshot(null);
    setCloseoutOpen(true);
    await loadCloseoutPreview(range);
  };

  const openCustomCloseout = async () => {
    const range = getPresetRange('custom');
    setCloseoutRange(range);
    setCustomStart(toDateInputValue(range.start));
    setCustomEnd(toDateInputValue(new Date(range.end.getTime() - 1)));
    setActiveSnapshot(null);
    setCloseoutOpen(true);
    await loadCloseoutPreview(range);
  };

  const loadCloseoutPreview = async (range: CloseoutRange) => {
    setCloseoutLoading(true);
    setCloseoutError(null);
    try {
      const data = await fetchCloseoutPreview(range, admin?.shop_id ?? null);
      setCloseoutPreview(data);
    } catch (error) {
      console.error('Failed to load closeout preview:', error);
      setCloseoutError('Unable to load closeout preview');
      setCloseoutPreview(null);
    } finally {
      setCloseoutLoading(false);
    }
  };

  const handleApplyCustomRange = async () => {
    if (!customStart || !customEnd) return;
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T00:00:00`);
    if (end < start) {
      setCloseoutError('End date must be on or after start date.');
      return;
    }
    const inclusiveEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
    const range: CloseoutRange = {
      start,
      end: inclusiveEnd,
      label: 'Custom',
      periodType: 'custom',
    };
    setCloseoutRange(range);
    setActiveSnapshot(null);
    await loadCloseoutPreview(range);
  };

  const handleSaveSnapshot = async () => {
    if (!closeoutPreview || !closeoutRange) return;
    const createdBy = admin?.auth_user_id ?? superAdmin?.id;
    if (!createdBy || !admin?.shop_id) return;
    setSavingSnapshot(true);
    try {
      const inclusiveEnd = new Date(closeoutRange.end.getTime() - 24 * 60 * 60 * 1000);
      const payload = {
        shop_id: admin.shop_id,
        location_id: null,
        period_type: closeoutRange.periodType,
        start_date: closeoutRange.start.toISOString().split('T')[0],
        end_date: inclusiveEnd.toISOString().split('T')[0],
        status: 'draft',
        totals_json: closeoutPreview,
        created_by: createdBy,
      };
      const { data, error } = await supabase
        .from('closeout_snapshots')
        .insert(payload)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setActiveSnapshot(data);
        setCloseoutSnapshots((prev) => [data, ...prev].slice(0, 8));
      }
    } catch (error) {
      console.error('Failed to save closeout snapshot:', error);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleFinalizeSnapshot = async () => {
    if (!activeSnapshot) return;
    const finalizedBy = admin?.auth_user_id ?? superAdmin?.id;
    if (!finalizedBy) return;
    setFinalizingSnapshot(true);
    try {
      const { data, error } = await supabase
        .from('closeout_snapshots')
        .update({
          status: 'finalized',
          finalized_by: finalizedBy,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', activeSnapshot.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setActiveSnapshot(data);
        setCloseoutSnapshots((prev) =>
          prev.map((snap) => (snap.id === data.id ? data : snap))
        );
      }
    } catch (error) {
      console.error('Failed to finalize closeout snapshot:', error);
    } finally {
      setFinalizingSnapshot(false);
    }
  };

  const openSnapshot = (snapshot: CloseoutSnapshot) => {
    const preview = snapshot.totals_json as CloseoutPreview;
    const endExclusive = new Date(`${snapshot.end_date}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    setActiveSnapshot(snapshot);
    setCloseoutPreview(preview);
    setCloseoutRange({
      start: new Date(snapshot.start_date),
      end: endExclusive,
      label: preview?.period?.label || 'Saved Closeout',
      periodType: preview?.period?.periodType || 'custom',
    });
    setCustomStart(snapshot.start_date);
    setCustomEnd(snapshot.end_date);
    setCloseoutOpen(true);
    setCloseoutError(null);
  };

  const handleExportCsv = () => {
    if (!closeoutPreview) return;
    const rows = closeoutPreview.roList.map((row) => ({
      'RO #': row.ro_number,
      Customer: row.customer_name || '',
      Vehicle: row.vehicle_label || '',
      'Closed At': row.closed_at || '',
      'Labor Total': row.labor_total,
      'Parts Total': row.parts_total,
      'Fees Total': row.fees_total,
      'Tax Total': row.tax_total,
      'Grand Total': row.grand_total,
    }));

    const headers = rows.length
      ? Object.keys(rows[0])
      : ['RO #', 'Customer', 'Vehicle', 'Closed At', 'Labor Total', 'Parts Total', 'Fees Total', 'Tax Total', 'Grand Total'];
    const csvLines = [
      headers.join(','),
      ...rows.map((row) => headers.map((key) => JSON.stringify((row as any)[key] ?? '')).join(',')),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `closeout-${closeoutPreview.period.label.toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'from-amber-600 to-amber-700';
      case 'silver': return 'from-slate-400 to-slate-500';
      case 'gold': return 'from-yellow-400 to-yellow-500';
      case 'platinum': return 'from-cyan-400 to-cyan-500';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading insights...</div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Unable to load insights data</p>
      </div>
    );
  }

  const maxDailySignup = Math.max(...insights.dailySignups.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-slate-700" />
        <h2 className="text-2xl font-bold text-slate-900">Business Insights</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Closeouts</h3>
            <p className="text-xs text-slate-500">One-click summaries for accounting and review.</p>
          </div>
          <button
            onClick={openCustomCloseout}
            className="text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Custom...
          </button>
        </div>
        <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => openCloseoutPreview('today')}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:border-slate-300"
          >
            End of Day (Today)
          </button>
          <button
            onClick={() => openCloseoutPreview('yesterday')}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:border-slate-300"
          >
            End of Day (Yesterday)
          </button>
          <button
            onClick={() => openCloseoutPreview('this_week')}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:border-slate-300"
          >
            End of Week (This)
          </button>
          <button
            onClick={() => openCloseoutPreview('last_week')}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:border-slate-300"
          >
            End of Week (Last)
          </button>
          <button
            onClick={() => openCloseoutPreview('this_month')}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:border-slate-300"
          >
            End of Month (This)
          </button>
        </div>
        {closeoutSnapshots.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600 mb-2">Saved Closeouts</p>
            <div className="flex flex-wrap gap-2">
              {closeoutSnapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  onClick={() => openSnapshot(snapshot)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:border-slate-300 flex items-center gap-2"
                >
                  <span>
                    {(() => {
                      const endExclusive = new Date(snapshot.end_date);
                      endExclusive.setDate(endExclusive.getDate() + 1);
                      return formatDateRange(new Date(snapshot.start_date), endExclusive);
                    })()}
                  </span>
                  <span className={`text-[10px] uppercase ${snapshot.status === 'finalized' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {snapshot.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandSettings.primary_color}15` }}>
              <Users className="w-6 h-6" style={{ color: brandSettings.primary_color }} />
            </div>
            <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4" />
              +{insights.newSignups7Days} this week
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatNumber(insights.totalCustomers)}</p>
          <p className="text-sm text-slate-600 mt-1">Total Customers</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatNumber(insights.newSignups30Days)}</p>
          <p className="text-sm text-slate-600 mt-1">New Signups (30 days)</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatNumber(insights.totalPointsEarned)}</p>
          <p className="text-sm text-slate-600 mt-1">Total Points Earned</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatNumber(insights.totalPointsRedeemed)}</p>
          <p className="text-sm text-slate-600 mt-1">Total Points Redeemed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(insights.totalLifetimeRevenue)}</p>
          <p className="text-sm text-slate-600 mt-1">Total Lifetime Revenue</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(insights.revenueLast30Days)}</p>
          <p className="text-sm text-slate-600 mt-1">Revenue (Last 30 Days)</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-violet-50 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-violet-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatNumber(insights.totalServicesCompleted)}</p>
          <p className="text-sm text-slate-600 mt-1">Services Completed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Signups (Last 30 Days)</h3>
          <div className="h-40 flex items-end gap-1">
            {insights.dailySignups.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${(day.count / maxDailySignup) * 100}%`,
                    minHeight: day.count > 0 ? '4px' : '0',
                    backgroundColor: brandSettings.primary_color
                  }}
                  title={`${day.date}: ${day.count} signups`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Tier Distribution</h3>
          <div className="space-y-4">
            {['platinum', 'gold', 'silver', 'bronze'].map(tier => {
              const tierData = insights.topTierDistribution.find(t => t.tier === tier);
              const count = tierData?.count || 0;
              const percentage = insights.totalCustomers > 0
                ? Math.round((count / insights.totalCustomers) * 100)
                : 0;

              return (
                <div key={tier}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{getTierDisplayName(tier)}</span>
                    <span className="text-sm text-slate-600">{count} ({percentage}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getTierColor(tier)} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Customer Types</h3>
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">With Accounts</span>
              <span className="text-sm font-semibold text-slate-900">{insights.customersWithAccounts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Walk-ins</span>
              <span className="text-sm font-semibold text-slate-900">{insights.walkInCustomers}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="h-full transition-all"
                style={{
                  width: `${insights.totalCustomers > 0 ? (insights.customersWithAccounts / insights.totalCustomers) * 100 : 0}%`,
                  backgroundColor: brandSettings.primary_color
                }}
              />
              <div
                className="h-full bg-slate-300"
                style={{
                  width: `${insights.totalCustomers > 0 ? (insights.walkInCustomers / insights.totalCustomers) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Avg Points per Customer</h3>
          <p className="text-4xl font-bold mt-4" style={{ color: brandSettings.primary_color }}>
            {formatNumber(insights.averagePointsPerCustomer)}
          </p>
          <p className="text-sm text-slate-600 mt-1">points average</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Points Economy</h3>
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Earned</span>
              <span className="text-sm font-semibold text-emerald-600">+{formatNumber(insights.totalPointsEarned)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Redeemed</span>
              <span className="text-sm font-semibold text-amber-600">-{formatNumber(insights.totalPointsRedeemed)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Outstanding</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatNumber(insights.totalPointsEarned - insights.totalPointsRedeemed)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {closeoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-none sm:rounded-2xl shadow-xl border border-slate-200 w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden closeout-print">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Closeout Summary</h3>
                <p className="text-sm text-slate-500">
                  {closeoutRange ? formatDateRange(closeoutRange.start, closeoutRange.end) : 'Custom Range'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Based on posted/closed repair orders for the selected range.
                </p>
              </div>
              <button
                className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                onClick={() => setCloseoutOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Range</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {closeoutRange ? formatDateRange(closeoutRange.start, closeoutRange.end) : 'Custom'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {activeSnapshot?.status === 'finalized' ? 'Finalized' : 'Draft'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">Custom Range</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="date"
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                    <span className="text-xs text-slate-400">to</span>
                    <input
                      type="date"
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                    <button
                      onClick={handleApplyCustomRange}
                      className="px-2 py-1 text-xs rounded-lg border border-slate-200 hover:border-slate-300"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {closeoutLoading && (
                <div className="text-sm text-slate-500">Loading closeout preview...</div>
              )}
              {closeoutError && (
                <div className="text-sm text-rose-500">{closeoutError}</div>
              )}

              {!closeoutLoading && closeoutPreview && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">Net Sales</p>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(closeoutPreview.kpis.netSales)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">GP$</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {closeoutPreview.kpis.grossProfit === null ? '—' : formatCurrency(closeoutPreview.kpis.grossProfit)}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">GP%</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {closeoutPreview.kpis.grossProfitPercent === null ? '—' : `${closeoutPreview.kpis.grossProfitPercent.toFixed(1)}%`}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">Car Count</p>
                      <p className="text-lg font-semibold text-slate-900">{formatNumber(closeoutPreview.kpis.carCount)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">ARO</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {formatCurrency(closeoutPreview.kpis.averageRepairOrder)}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">Hours Sold</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {closeoutPreview.kpis.hoursSold.toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">ELR</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {closeoutPreview.kpis.effectiveLaborRate === null
                          ? '—'
                          : formatCurrency(closeoutPreview.kpis.effectiveLaborRate)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Sales Breakdown</h4>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Labor</span>
                          <span>{formatCurrency(closeoutPreview.sales.labor)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Parts</span>
                          <span>{formatCurrency(closeoutPreview.sales.parts)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Fees</span>
                          <span>{formatCurrency(closeoutPreview.sales.fees)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Tax</span>
                          <span>{formatCurrency(closeoutPreview.sales.tax)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Discounts</span>
                          <span>{formatCurrency(closeoutPreview.sales.discounts)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Operational Flags</h4>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Open ROs</span>
                          <span>{formatNumber(closeoutPreview.operational.openRos)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Awaiting Approval</span>
                          <span>{formatNumber(closeoutPreview.operational.awaitingApproval)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Parts Waiting</span>
                          <span>{formatNumber(closeoutPreview.operational.partsWaiting)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Rewards Summary</h4>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Points Earned</span>
                          <span>{formatNumber(closeoutPreview.rewards.pointsEarned)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Points Redeemed</span>
                          <span>{formatNumber(closeoutPreview.rewards.pointsRedeemed)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Payments Summary</h4>
                      {Object.keys(closeoutPreview.payments).length === 0 ? (
                        <p className="text-sm text-slate-500">No payment data available.</p>
                      ) : (
                        <div className="space-y-2 text-sm text-slate-600">
                          {Object.entries(closeoutPreview.payments).map(([method, total]) => (
                            <div key={method} className="flex items-center justify-between">
                              <span>{method}</span>
                              <span>{formatCurrency(total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">Repair Orders</h4>
                    <div className="overflow-auto">
                      <table className="min-w-full text-sm text-slate-600">
                        <thead>
                          <tr className="text-left border-b border-slate-200">
                            <th className="py-2 pr-4">RO #</th>
                            <th className="py-2 pr-4">Customer</th>
                            <th className="py-2 pr-4">Vehicle</th>
                            <th className="py-2 pr-4">Closed</th>
                            <th className="py-2 pr-4">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closeoutPreview.roList.map((row) => (
                            <tr key={row.id} className="border-b border-slate-100">
                              <td className="py-2 pr-4">{row.ro_number}</td>
                              <td className="py-2 pr-4">{row.customer_name || '—'}</td>
                              <td className="py-2 pr-4">{row.vehicle_label || '—'}</td>
                              <td className="py-2 pr-4">{row.closed_at ? new Date(row.closed_at).toLocaleDateString() : '—'}</td>
                              <td className="py-2 pr-4">{formatCurrency(row.grand_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {closeoutPreview.roList.length === 0 && (
                        <p className="text-sm text-slate-500 mt-3">No closed repair orders in this range.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-slate-100 p-4 flex flex-wrap gap-2 justify-between items-center bg-white">
              <div className="text-xs text-slate-500">
                {activeSnapshot?.status === 'finalized'
                  ? 'Finalized closeout (read-only)'
                  : 'Draft closeout'}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCloseoutOpen(false)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-lg flex items-center gap-1"
                  disabled={!closeoutPreview}
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-lg flex items-center gap-1"
                  disabled={!closeoutPreview}
                >
                  <Printer className="w-3 h-3" /> Print / PDF
                </button>
                <button
                  onClick={handleSaveSnapshot}
                  className="px-3 py-2 text-xs bg-slate-900 text-white rounded-lg flex items-center gap-1 disabled:opacity-60"
                  disabled={!closeoutPreview || savingSnapshot}
                >
                  <Save className="w-3 h-3" /> Save Snapshot
                </button>
                {activeSnapshot && activeSnapshot.status !== 'finalized' && (
                  <button
                    onClick={handleFinalizeSnapshot}
                    className="px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg disabled:opacity-60"
                    disabled={finalizingSnapshot}
                  >
                    Finalize / Lock
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
