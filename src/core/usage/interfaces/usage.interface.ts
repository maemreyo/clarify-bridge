// Updated: Usage tracking interfaces

import { SubscriptionTier } from '@prisma/client';

export interface UsageQuota {
  specifications: number;
  aiGenerations: number;
  teamMembers: number;
  storage: number; // in MB
  apiCalls: number;
}

export const USAGE_QUOTAS: Record<SubscriptionTier, UsageQuota> = {
  [SubscriptionTier.FREE]: {
    specifications: 5,
    aiGenerations: 20,
    teamMembers: 3,
    storage: 100,
    apiCalls: 1000,
  },
  [SubscriptionTier.STARTER]: {
    specifications: 50,
    aiGenerations: 200,
    teamMembers: 10,
    storage: 1000,
    apiCalls: 10000,
  },
  [SubscriptionTier.PROFESSIONAL]: {
    specifications: 500,
    aiGenerations: 2000,
    teamMembers: 50,
    storage: 10000,
    apiCalls: 100000,
  },
  [SubscriptionTier.ENTERPRISE]: {
    specifications: -1, // unlimited
    aiGenerations: -1,
    teamMembers: -1,
    storage: -1,
    apiCalls: -1,
  },
};

export interface UsageStats {
  period: {
    start: Date;
    end: Date;
  };
  usage: {
    specifications: number;
    aiGenerations: number;
    teamMembers: number;
    storage: number;
    apiCalls: number;
  };
  quota: UsageQuota;
  percentages: {
    specifications: number;
    aiGenerations: number;
    teamMembers: number;
    storage: number;
    apiCalls: number;
  };
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  remaining?: number;
}

export type UsageAction =
  | 'spec_generated'
  | 'ai_generation'
  | 'view_generated'
  | 'vector_stored'
  | 'vector_search'
  | 'api_call'
  | 'file_uploaded'
  | 'team_member_added';

// ============================================