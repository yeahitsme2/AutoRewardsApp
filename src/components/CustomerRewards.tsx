import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Gift, Award, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { RewardItem, RewardRedemption } from '../types/database';

interface RedemptionWithReward extends RewardRedemption {
  reward_item: RewardItem | null;
}

export function CustomerRewards() {
  const { customer } = useAuth();
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionWithReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [rewardsResult, redemptionsResult] = await Promise.all([
        supabase
          .from('reward_items')
          .select('*')
          .eq('is_active', true)
          .order('points_required', { ascending: true }),
        supabase
          .from('reward_redemptions')
          .select('*, reward_item:reward_items(*)')
          .order('created_at', { ascending: false }),
      ]);

      if (rewardsResult.error) throw rewardsResult.error;
      if (redemptionsResult.error) throw redemptionsResult.error;

      setRewards(rewardsResult.data || []);
      setRedemptions(redemptionsResult.data as RedemptionWithReward[] || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const canAfford = (pointsCost: number) => {
    return (customer?.reward_points || 0) >= pointsCost;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'denied':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      case 'denied':
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading rewards...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Award className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Your Reward Points</h2>
        </div>
        <p className="text-4xl font-bold mb-2">{customer?.reward_points || 0} points</p>
        <p className="text-emerald-100">Redeem points for exclusive rewards and discounts</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-6 h-6 text-slate-700" />
          <h3 className="text-xl font-bold text-slate-900">Available Rewards</h3>
        </div>

        {rewards.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Gift className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-slate-900 mb-2">No Rewards Available</h4>
            <p className="text-slate-600">Check back later for new rewards.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => {
              const affordable = canAfford(reward.points_required);
              return (
                <div
                  key={reward.id}
                  className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                    affordable
                      ? 'border-emerald-200 hover:border-emerald-300'
                      : 'border-slate-200 opacity-75'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">{reward.name}</h4>
                        <p className="text-sm text-slate-600">{reward.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <Award className="w-5 h-5" />
                        <span>{reward.points_required} pts</span>
                      </div>
                      {affordable ? (
                        <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
                          Can Redeem
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                          {reward.points_required - (customer?.reward_points || 0)} more pts
                        </div>
                      )}
                    </div>

                    {affordable && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-sm text-slate-600 text-center">
                          Visit us or call to redeem this reward
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-6 h-6 text-slate-700" />
          <h3 className="text-xl font-bold text-slate-900">Redemption History</h3>
        </div>

        {redemptions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-slate-900 mb-2">No Redemptions Yet</h4>
            <p className="text-slate-600">Your reward redemptions will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {redemptions.map((redemption) => (
                <div key={redemption.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(redemption.status)}
                        <h4 className="font-semibold text-slate-900">
                          {redemption.reward_item?.name || 'Reward removed'}
                        </h4>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                            redemption.status
                          )}`}
                        >
                          {redemption.status}
                        </span>
                      </div>
                      {redemption.reward_item?.description && (
                        <p className="text-sm text-slate-600 mb-1">{redemption.reward_item.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>{new Date(redemption.processed_at || redemption.created_at).toLocaleDateString()}</span>
                        <span>{redemption.points_spent} points</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
