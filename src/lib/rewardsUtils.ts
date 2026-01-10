import type { Customer, RewardItem } from '../types/database';

export interface TierInfo {
  name: string;
  displayName: string;
  minPoints: number;
  multiplier: number;
  color: string;
  gradient: string;
}

export const TIER_LEVELS: Record<string, TierInfo> = {
  bronze: {
    name: 'bronze',
    displayName: 'Bronze',
    minPoints: 0,
    multiplier: 1.0,
    color: 'text-orange-700',
    gradient: 'from-orange-400 to-orange-600',
  },
  silver: {
    name: 'silver',
    displayName: 'Silver',
    minPoints: 500,
    multiplier: 1.25,
    color: 'text-slate-600',
    gradient: 'from-slate-300 to-slate-500',
  },
  gold: {
    name: 'gold',
    displayName: 'Gold',
    minPoints: 1500,
    multiplier: 1.5,
    color: 'text-yellow-600',
    gradient: 'from-yellow-400 to-yellow-600',
  },
  platinum: {
    name: 'platinum',
    displayName: 'Platinum',
    minPoints: 3000,
    multiplier: 2.0,
    color: 'text-slate-800',
    gradient: 'from-slate-400 to-slate-700',
  },
};

export function getTierInfo(tierName: string): TierInfo {
  return TIER_LEVELS[tierName] || TIER_LEVELS.bronze;
}

export function getNextTier(currentTier: string): TierInfo | null {
  const tiers = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null;
  }

  return TIER_LEVELS[tiers[currentIndex + 1]];
}

export function calculateProgressToNextTier(customer: Customer): {
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  progressPercent: number;
  pointsNeeded: number;
} {
  const currentTier = getTierInfo(customer.tier);
  const nextTier = getNextTier(customer.tier);

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

export function calculateSpendingToNextTier(customer: Customer): {
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  cashNeeded: number;
} {
  const currentTier = getTierInfo(customer.tier);
  const nextTier = getNextTier(customer.tier);

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      cashNeeded: 0,
    };
  }

  const currentPoints = customer.reward_points;
  const pointsNeeded = Math.max(0, nextTier.minPoints - currentPoints);

  // Calculate how much they need to spend to earn those points
  // Assuming 1 point per dollar spent with their current multiplier
  const cashNeeded = pointsNeeded / currentTier.multiplier;

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

  const affordableRewards = activeRewards.filter((r) => r.points_cost > currentPoints);

  if (affordableRewards.length === 0) {
    return null;
  }

  affordableRewards.sort((a, b) => a.points_cost - b.points_cost);
  const nextReward = affordableRewards[0];
  const pointsNeeded = nextReward.points_cost - currentPoints;
  const progressPercent = (currentPoints / nextReward.points_cost) * 100;

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
