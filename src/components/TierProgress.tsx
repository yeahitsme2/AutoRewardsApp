import { Award, Crown, TrendingUp } from 'lucide-react';
import type { Customer } from '../types/database';
import { calculateProgressToNextTier } from '../lib/rewardsUtils';
import { useBrand } from '../lib/BrandContext';

interface TierProgressProps {
  customer: Customer;
}

export function TierProgress({ customer }: TierProgressProps) {
  const { brandSettings } = useBrand();
  const { currentTier, nextTier, progressPercent, pointsNeeded } = calculateProgressToNextTier(customer, brandSettings);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 bg-gradient-to-br ${currentTier.gradient} rounded-lg flex items-center justify-center`}>
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-slate-600">Membership Tier</p>
            <p className={`text-2xl font-bold ${currentTier.color}`}>{currentTier.displayName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-600">Points Multiplier</p>
          <p className="text-2xl font-bold text-emerald-600">{currentTier.multiplier}x</p>
        </div>
      </div>

      {nextTier ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Progress to {nextTier.displayName}</span>
            <span className="font-semibold text-slate-900">
              {customer.reward_points} / {nextTier.minPoints} points
            </span>
          </div>
          <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${nextTier.gradient} transition-all duration-500 rounded-full`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
            <TrendingUp className="w-4 h-4" />
            <span>
              Just <span className="font-bold">{pointsNeeded} points</span> away from {nextTier.displayName} tier
              (earn {nextTier.multiplier}x points!)
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-3 rounded-lg">
          <Award className="w-5 h-5" />
          <span className="font-medium">You've reached the highest tier! Enjoy maximum rewards.</span>
        </div>
      )}
    </div>
  );
}
