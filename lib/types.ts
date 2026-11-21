export interface Signal {
  id: string;
  asset: string;
  pair: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  confidence: number; // 0–100
  price: string;
  timestamp: string;
  analysis: string; // technical analysis copy — can be long
  tags?: string[];
  providerId?: string;
  providerStake?: number;
  providerReputation?: number;
  /**
   * ISO timestamp of the provider's first recorded signal, used to derive the
   * provider track-record length. Absent when the provider has no history.
   */
  providerFirstSignalAt?: string;
  /** Whether this signal requires a premium stake to access */
  isPremium?: boolean;
  /** Whether the current user meets the stake requirement */
  hasAccess?: boolean;
  /** Minimum XLM stake required to unlock */
  requiredStake?: number;
  /** ISO timestamp of the last revision/update to this signal */
  lastUpdated?: string;
  /** Whether this signal has been updated since initial publication */
  hasRevision?: boolean;
}

export interface SignalProvider {
  id: string;
  address: string;
  name?: string;
  overallScore: number; // 0–100
  winRate: number; // 0–100
  totalSignals: number;
  recentPerformance: number; // percentage
  rank: number;
  bio?: string;
  reputation?: number; // 0–100
  staked?: number;
  trustScore?: number; // 0–100
}

export interface ProviderSignal {
  id: string;
  asset: string;
  direction: "BUY" | "SELL";
  confidence: number;
  timestamp: string;
  outcome: "WIN" | "LOSS" | "PENDING";
  targetPrice: number;
  actualPrice?: number;
  /** ISO timestamp of the last revision/update to this signal */
  lastUpdated?: string;
  /** Whether this signal has been updated since initial publication */
  hasRevision?: boolean;
}
