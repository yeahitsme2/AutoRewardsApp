import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBrand } from '../lib/BrandContext';
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
  ArrowDownRight
} from 'lucide-react';

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
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

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
            {insights.dailySignups.map((day, index) => (
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
    </div>
  );
}
