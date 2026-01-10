import { useEffect, useState } from 'react';
import { Gift, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Customer, RewardItem } from '../types/database';
import { calculateProgressToNextReward } from '../lib/rewardsUtils';

interface RewardProgressProps {
  customer: Customer;
}

export function RewardProgress({ customer }: RewardProgressProps) {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      const { data, error } = await supabase
        .from('reward_items')
        .select('*')
        .eq('is_active', true)
        .order('points_required', { ascending: true });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  const nextRewardInfo = calculateProgressToNextReward(customer.reward_points, rewards);

  if (!nextRewardInfo) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Gift className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-600">Next Reward</p>
            <p className="text-lg font-bold text-slate-900">All rewards unlocked!</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          You have enough points for all available rewards. Check out the Rewards tab to redeem them!
        </p>
      </div>
    );
  }

  const { reward, pointsNeeded, progressPercent } = nextRewardInfo;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
          <Target className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-600">Next Reward Goal</p>
          <p className="text-lg font-bold text-slate-900">{reward.name}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Your progress</span>
          <span className="font-semibold text-slate-900">
            {customer.reward_points} / {reward.points_required} points
          </span>
        </div>
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          <Gift className="w-4 h-4" />
          <span>
            Just <span className="font-bold">{pointsNeeded} points</span> away from {reward.name}!
          </span>
        </div>
      </div>
    </div>
  );
}
