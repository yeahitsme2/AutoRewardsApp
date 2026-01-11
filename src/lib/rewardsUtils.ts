import type { Customer, RewardItem } from '../types/database';

export interface TierInfo {
  name: string;
  displayName: string;
  minPoints: number;
  multiplier: number;
  color: string;
  gradient: string;
}

export interface TierSettings {
  silver_points_min: number;
  gold_points_min: number;
  platinum_points_min: number;
  bronze_multiplier: number;
  silver_multiplier: number;
  gold_multiplier: number;
  platinum_multiplier: number;
  points_per_dollar: number;
}

export function getTierLevels(settings: TierSettings): Record<string, TierInfo> {
  return {
    bronze: {
      name: 'bronze',
      displayName: 'Bronze',
      minPoints: 0,
      multiplier: settings.bronze_multiplier,
      color: 'text-orange-700',
      gradient: 'from-orange-400 to-orange-600',
    },
    silver: {
      name: 'silver',
      displayName: 'Silver',
      minPoints: settings.silver_points_min,
      multiplier: settings.silver_multiplier,
      color: 'text-slate-600',
      gradient: 'from-slate-300 to-slate-500',
    },
    gold: {
      name: 'gold',
      displayName: 'Gold',
      minPoints: settings.gold_points_min,
      multiplier: settings.gold_multiplier,
      color: 'text-yellow-600',
      gradient: 'from-yellow-400 to-yellow-600',
    },
    platinum: {
      name: 'platinum',
      displayName: 'Platinum',
      minPoints: settings.platinum_points_min,
      multiplier: settings.platinum_multiplier,
      color: 'text-slate-800',
      gradient: 'from-slate-400 to-slate-700',
    },
  };
}

export function getTierInfo(tierName: string, settings: TierSettings): TierInfo {
  const tierLevels = getTierLevels(settings);
  return tierLevels[tierName] || tierLevels.bronze;
}

export function getNextTier(currentTier: string, settings: TierSettings): TierInfo | null {
  const tiers = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null;
  }

  const tierLevels = getTierLevels(settings);
  return tierLevels[tiers[currentIndex + 1]];
}

export function calculateProgressToNextTier(customer: Customer, settings: TierSettings): {
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  progressPercent: number;
  pointsNeeded: number;
} {
  const currentTier = getTierInfo(customer.tier, settings);
  const nextTier = getNextTier(customer.tier, settings);

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      progressPercent: 100,
      pointsNeeded: 0,
    };
  }

  const points = customer.reward_points;
  const currentMin = currentTier.minPoints;
  const nextMin = nextTier.minPoints;
  const range = nextMin - currentMin;
  const progress = points - currentMin;
  const progressPercent = Math.min(100, (progress / range) * 100);
  const pointsNeeded = Math.max(0, nextMin - points);

  return {
    currentTier,
    nextTier,
    progressPercent,
    pointsNeeded,
  };
}

export function calculateSpendingToNextTier(customer: Customer, settings: TierSettings): {
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  cashNeeded: number;
} {
  const currentTier = getTierInfo(customer.tier, settings);
  const nextTier = getNextTier(customer.tier, settings);

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      cashNeeded: 0,
    };
  }

  const currentPoints = customer.reward_points;
  const pointsNeeded = Math.max(0, nextTier.minPoints - currentPoints);

  const cashNeeded = pointsNeeded / (settings.points_per_dollar * currentTier.multiplier);

  return {
    currentTier,
    nextTier,
    cashNeeded,
  };
}

export interface NextRewardInfo {
  reward: RewardItem;
  pointsNeeded: number;
  progressPercent: number;
}

export function calculateProgressToNextReward(
  currentPoints: number,
  rewards: RewardItem[]
): NextRewardInfo | null {
  const activeRewards = rewards.filter((r) => r.is_active);

  const affordableRewards = activeRewards.filter((r) => r.points_required > currentPoints);

  if (affordableRewards.length === 0) {
    return null;
  }

  affordableRewards.sort((a, b) => a.points_required - b.points_required);
  const nextReward = affordableRewards[0];
  const pointsNeeded = nextReward.points_required - currentPoints;
  const progressPercent = (currentPoints / nextReward.points_required) * 100;

  return {
    reward: nextReward,
    pointsNeeded,
    progressPercent,
  };
}

export interface ServiceReminder {
  type: 'overdue' | 'upcoming' | 'due-soon';
  message: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  milesOverdue?: number;
  milesUntilDue?: number;
}

export function calculateServiceReminders(
  lastServiceDate: string | null,
  lastServiceMileage: number | null,
  currentMileage: number,
  nextServiceDueDate: string | null,
  nextServiceDueMileage: number | null
): ServiceReminder | null {
  const now = new Date();

  if (nextServiceDueDate) {
    const dueDate = new Date(nextServiceDueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return {
        type: 'overdue',
        message: 'Service is overdue',
        daysOverdue: Math.abs(daysUntilDue),
      };
    } else if (daysUntilDue <= 14) {
      return {
        type: 'due-soon',
        message: 'Service due soon',
        daysUntilDue,
      };
    } else if (daysUntilDue <= 30) {
      return {
        type: 'upcoming',
        message: 'Service coming up',
        daysUntilDue,
      };
    }
  }

  if (nextServiceDueMileage && currentMileage) {
    const milesUntilDue = nextServiceDueMileage - currentMileage;

    if (milesUntilDue < 0) {
      return {
        type: 'overdue',
        message: 'Service is overdue by mileage',
        milesOverdue: Math.abs(milesUntilDue),
      };
    } else if (milesUntilDue <= 500) {
      return {
        type: 'due-soon',
        message: 'Service due soon by mileage',
        milesUntilDue,
      };
    } else if (milesUntilDue <= 1000) {
      return {
        type: 'upcoming',
        message: 'Service coming up by mileage',
        milesUntilDue,
      };
    }
  }

  return null;
}
