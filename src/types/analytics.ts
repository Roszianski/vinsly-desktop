/**
 * Analytics Types
 * Types for tracking Claude Code usage and session data
 */

export interface SessionInfo {
  id: string;
  projectPath: string;
  projectName: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  messageCount: number;
  estimatedTokens: number;
  estimatedCost: number;
}

export interface DailyUsage {
  date: string; // ISO date string (YYYY-MM-DD)
  totalTokens: number;
  sessionCount: number;
  estimatedCost: number;
}

export interface UsageSummary {
  thisWeek: {
    totalTokens: number;
    sessionCount: number;
    estimatedCost: number;
    percentOfLimit: number;
  };
  today: {
    totalTokens: number;
    sessionCount: number;
    estimatedCost: number;
    changeFromAverage: number; // percentage change from daily average
  };
  resetInfo: {
    nextResetDate: Date;
    daysUntilReset: number;
    hoursUntilReset: number;
  };
  dailyUsage: DailyUsage[];
  recentSessions: SessionInfo[];
}

export interface ContextBreakdown {
  conversationHistory: number;
  fileContents: number;
  memoryFiles: number;
  toolResults: number;
  total: number;
  maxContext: number;
  percentUsed: number;
}

// Claude Code pricing (per 1M tokens)
export const CLAUDE_PRICING = {
  sonnet: { input: 3, output: 15 },
  haiku: { input: 0.25, output: 1.25 },
  opus: { input: 15, output: 75 },
} as const;

// Estimated weekly limits by plan (rough estimates)
export const PLAN_LIMITS = {
  pro: 2_800_000, // ~2.8M tokens/week
  max5: 5_600_000, // ~5.6M tokens/week
  max20: 14_000_000, // ~14M tokens/week
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export interface AnalyticsState {
  isLoading: boolean;
  error: string | null;
  summary: UsageSummary | null;
  contextBreakdown: ContextBreakdown | null;
  lastUpdated: Date | null;
}
