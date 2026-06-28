/**
 * Centralized React Query options factory.
 *
 * Categories and their rationale:
 * - signal      : Feed data changes frequently; 30 s stale, 5 min gc, refetch on focus.
 * - price       : Real-time price polling uses its own interval; not fetched via React Query.
 * - portfolio   : User-specific, moderately fresh; 60 s stale, 5 min gc, refetch on focus.
 * - leaderboard : Rankings are slow-changing; 5 min stale, 10 min gc, no refetch on focus.
 * - provider    : Profile data is slow-changing; 5 min stale, 15 min gc, no refetch on focus.
 */

const MS = {
  s30: 30_000,
  min1: 60_000,
  min5: 5 * 60_000,
  min10: 10 * 60_000,
  min15: 15 * 60_000,
} as const;

export const queryOptions = {
  /** Signal feed & individual signal lookups */
  signal: {
    staleTime: MS.min5,
    gcTime: MS.min10,
    refetchOnWindowFocus: true,
  },
  /** User portfolio data */
  portfolio: {
    staleTime: MS.min1,
    gcTime: MS.min5,
    refetchOnWindowFocus: true,
  },
  /** Leaderboard rankings */
  leaderboard: {
    staleTime: MS.min5,
    gcTime: MS.min10,
    refetchOnWindowFocus: false,
  },
  /** Provider profile & provider signals */
  provider: {
    staleTime: MS.min5,
    gcTime: MS.min15,
    refetchOnWindowFocus: false,
  },
  /** Short-lived provider signal history (within a profile) */
  providerSignals: {
    staleTime: MS.s30,
    gcTime: MS.min5,
    refetchOnWindowFocus: false,
  },
} as const;
