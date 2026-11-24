"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  useProviderProfile,
  useProviderSignals,
} from "@/hooks/useProviderProfile";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  UserMinus,
  Inbox,
  MessageSquare,
  Pin,
  Search,
  ThumbsUp,
  Shield,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ListStateIndicator } from "@/components/ui/list-state-indicator";
import { DataPanelError } from "@/components/ui/data-panel-error";
import { NetworkErrorState } from "@/components/ui/network-error-state";
import { SignalEmptyState } from "@/components/provider/SignalEmptyState";
import { ProviderCoveredAssets } from "@/components/provider/ProviderCoveredAssets";
import { useProviderSignalScope } from "@/hooks/useProviderSignalScope";
import { PageTransition } from "@/components/PageTransition";
import { UnfollowDialog } from "@/components/UnfollowDialog";
import { useUnfollowDialog } from "@/hooks/useUnfollowDialog";
import { useFollowedProvidersStore } from "@/store/useFollowedProvidersStore";
import { usePaginationClamp } from "@/hooks/usePaginationClamp";
import { ReportDataDialog } from "@/components/provider/ReportDataDialog";
import { CopyButton } from "@/components/ui/copy-button";

const SIGNALS_PER_PAGE = 5;

interface ForumReply {
  id: string;
  author: string;
  body: string;
  likes: number;
  likedByMe: boolean;
}

interface ForumPost {
  id: string;
  title: string;
  body: string;
  author: string;
  reputation: number;
  pinned: boolean;
  likes: number;
  likedByMe: boolean;
  replies: ForumReply[];
}

const INITIAL_POSTS: ForumPost[] = [
  {
    id: "p1",
    title: "How do you size positions on this provider's signals?",
    body: "I've been following for a month and the win rate is solid, but I'm still unsure about position sizing. What works for you?",
    author: "0x9f...a12c",
    reputation: 42,
    pinned: true,
    likes: 12,
    likedByMe: false,
    replies: [
      {
        id: "r1",
        author: "0x3b...77de",
        body: "I scale in at 25% per signal and cap total exposure at 5% of my portfolio.",
        likes: 5,
        likedByMe: false,
      },
    ],
  },
  {
    id: "p2",
    title: "Anyone tracking this provider's drawdown periods?",
    body: "Curious whether the recent losing streak is within historical norms.",
    author: "0x1a...90ff",
    reputation: 18,
    pinned: false,
    likes: 4,
    likedByMe: false,
    replies: [],
  },
];

// Performance history range options and their lookback windows in days.
const RANGE_OPTIONS = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

// Signal scope options for the active / archived / combined view.
const SIGNAL_SCOPE_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
] as const;

const SIGNAL_SCOPE_LABELS: Record<
  (typeof SIGNAL_SCOPE_OPTIONS)[number]["key"],
  string
> = {
  active: "active",
  archived: "archived",
  all: "active and archived",
};

interface PerformancePoint {
  date: string;
  value: number;
}

// Builds a deterministic performance time series for the provider so the
// profile can chart how the metric changes over time. In a real app this
// would come from an API; here it is derived from the provider id so the
// chart is stable across renders.
function buildPerformanceSeries(
  seed: string,
  days: number
): PerformancePoint[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  const points: PerformancePoint[] = [];
  const today = new Date();
  let value = 50 + (hash % 20);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const wobble = Math.sin((hash + i) / 3) * 6 + Math.cos((hash + i) / 7) * 3;
    value = Math.max(0, Math.min(100, value + wobble * 0.15));
    points.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(value * 10) / 10,
    });
  }
  return points;
}

export default function ProviderProfilePage() {
  const router = useRouter();
  const params = useParams();
  const providerId = params?.providerId as string;

  const {
    data: provider,
    isLoading: providerLoading,
    isError: providerError,
    refetch: refetchProvider,
  } = useProviderProfile(providerId);

  // Active / archived / combined signal view. The selection is persisted so it
  // survives navigating away and back, and is reflected in the URL.
  const { scope, setScope } = useProviderSignalScope(providerId);

  const {
    data: signals = [],
    isFetching: signalsFetching,
    isLoading: signalsLoading,
    isError: signalsError,
    refetch: refetchSignals,
  } = useProviderSignals(providerId, scope);

  // Deduplicated list of Stellar assets this provider has covered, derived
  // from the profile data. Empty when the profile has no coverage data.
  const coveredAssets = useMemo(() => {
    const assets = provider?.coveredAssets ?? [];
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const asset of assets) {
      const key = asset.trim().toUpperCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(asset.trim());
    }
    return unique;
  }, [provider?.coveredAssets]);

  // Follow state is shared with the signal feed's "Followed" filter.
  // Feed signals identify their provider by name, so follows are keyed the same way.
  const followKey = provider?.name ?? provider?.address;
  const isFollowing = useFollowedProvidersStore(
    (s) => followKey !== undefined && s.followedProviders.includes(followKey)
  );
  const followProvider = useFollowedProvidersStore((s) => s.follow);
  const unfollowProvider = useFollowedProvidersStore((s) => s.unfollow);

  // Open positions copied from this provider — in a real app fetched from portfolio store
  const openCopiedPositions = signals.filter(
    (s) => s.outcome === "PENDING"
  ).length;

  const handleUnfollow = useCallback(() => {
    if (followKey) unfollowProvider(followKey);
  }, [followKey, unfollowProvider]);

  const { dialogState, requestUnfollow, handleConfirm, handleCancel } =
    useUnfollowDialog(handleUnfollow);

  // Keeps `page` valid as `signals` changes shape (new data, filtering,
  // etc.) instead of pointing at a page that no longer exists.
  const {
    page: currentPage,
    totalPages,
    offset,
    canGoPrevious,
    canGoNext,
    goToPrevious,
    goToNext,
  } = usePaginationClamp({
    totalItems: signals.length,
    pageSize: SIGNALS_PER_PAGE,
    resetKey: `${providerId}:${scope}`,
  });
  const paginatedSignals = signals.slice(offset, offset + SIGNALS_PER_PAGE);

  // Canonical, shareable profile URL — no query parameters or fragments.
  const profileUrl = useMemo(() => {
    const path = `/provider/${encodeURIComponent(providerId ?? "")}`;
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [providerId]);

  // Performance history range selection.
  const [range, setRange] = useState<RangeKey>("30d");

  // Report-data action state.
  const [reportOpen, setReportOpen] = useState(false);
  const selectedRange = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[1];

  const performanceSeries = useMemo(
    () => buildPerformanceSeries(providerId ?? "provider", selectedRange.days),
    [providerId, selectedRange.days]
  );

  const performanceSummary = useMemo(() => {
    if (performanceSeries.length === 0) return "";
    const first = performanceSeries[0];
    const last = performanceSeries[performanceSeries.length - 1];
    const change = Math.round((last.value - first.value) * 10) / 10;
    const direction = change >= 0 ? "up" : "down";
    return `Performance over the last ${selectedRange.label}: started at ${first.value} on ${first.date}, ended at ${last.value} on ${last.date}, ${direction} ${Math.abs(change)} points.`;
  }, [performanceSeries, selectedRange.label]);

  // Community forum state — discussion threads scoped to this provider.
  const [posts, setPosts] = useState<ForumPost[]>(INITIAL_POSTS);
  const [forumSearch, setForumSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  const handleCreatePost = useCallback(() => {
    const title = newTitle.trim();
    const body = newBody.trim();
    if (!title || !body) return;
    setPosts((prev) => [
      {
        id: `p${Date.now()}`,
        title,
        body,
        author: "You",
        reputation: 0,
        pinned: false,
        likes: 0,
        likedByMe: false,
        replies: [],
      },
      ...prev,
    ]);
    setNewTitle("");
    setNewBody("");
  }, [newTitle, newBody]);

  const handleLikePost = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes: post.likedByMe ? post.likes - 1 : post.likes + 1,
              likedByMe: !post.likedByMe,
            }
          : post
      )
    );
  }, []);

  const handleLikeReply = useCallback((postId: string, replyId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              replies: post.replies.map((reply) =>
                reply.id === replyId
                  ? {
                      ...reply,
                      likes: reply.likedByMe
                        ? reply.likes - 1
                        : reply.likes + 1,
                      likedByMe: !reply.likedByMe,
                    }
                  : reply
              ),
            }
          : post
      )
    );
  }, []);

  const handleAddReply = useCallback((postId: string) => {
    const body = (replyDrafts[postId] ?? "").trim();
    if (!body) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              replies: [
                ...post.replies,
                {
                  id: `r${Date.now()}`,
                  author: "You",
                  body,
                  likes: 0,
                  likedByMe: false,
                },
              ],
            }
          : post
      )
    );
    setReplyDrafts((prev) => ({ ...prev, [postId]: "" }));
  }, [replyDrafts]);

  const handleTogglePin = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, pinned: !post.pinned } : post
      )
    );
  }, []);

  const query = forumSearch.trim().toLowerCase();
  const visiblePosts = posts
    .filter((post) =>
      query
        ? post.title.toLowerCase().includes(query) ||
          post.body.toLowerCase().includes(query)
        : true
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  if (providerLoading) {
    return (
      <PageTransition>
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:gap-8 sm:p-8 bg-gray-950">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </PageTransition>
    );
  }

  if (providerError) {
    return (
      <PageTransition>
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:gap-8 sm:p-8 bg-gray-950">
          <NetworkErrorState
            title="Couldn't load this provider"
            description="We couldn't load the provider profile. Check your connection and try again."
            onRetry={() => refetchProvider()}
          />
          <Button onClick={() => router.back()}>Go Back</Button>
        </main>
      </PageTransition>
    );
  }

  if (!provider) {
    return (
      <PageTransition>
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:gap-8 sm:p-8 bg-gray-950">
          <p className="text-center text-red-500">Provider not found</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="flex min-h-screen flex-col gap-6 p-4 sm:gap-8 sm:p-8 bg-gray-950 w-full max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Go back to previous page"
        >
          <ArrowLeft size={16} className="rtl-flip" />
          Back
        </button>

        {/* Share / copy canonical profile link */}
        <section
          className="flex flex-wrap items-center justify-between gap-2"
          aria-label="Share provider profile"
        >
          <h1 className="text-lg font-semibold text-foreground">
            {provider.name ?? provider.address ?? "Provider profile"}
          </h1>
          <CopyButton
            value={profileUrl}
            label="Copy profile link"
            showValueOnError
          />
        </section>

        {/* Performance history chart */}
        <section
          className="rounded-lg border border-gray-800 bg-gray-900 p-4"
          aria-labelledby="performance-history-heading"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2
              id="performance-history-heading"
              className="text-sm font-semibold text-foreground"
            >
              Performance history
            </h2>
            <div
              role="group"
              aria-label="Select performance history range"
              className="flex gap-1"
            >
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key)}
                  aria-pressed={range === option.key}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    range === option.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mb-2 text-xs text-muted-foreground">
            Showing last {selectedRange.label}
          </p>

          {providerLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="sr-only">Loading performance history</span>
            </div>
          ) : performanceSeries.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No performance history available for this range.
            </div>
          ) : (
            <>
              <p className="sr-only" role="status">
                {performanceSummary}
              </p>
              <svg
                role="img"
                aria-label={performanceSummary}
                viewBox="0 0 300 100"
                className="h-32 w-full"
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={performanceSeries
                    .map((point, index) => {
                      const x =
                        (index / Math.max(1, performanceSeries.length - 1)) * 300;
                      const y = 100 - (point.value / 100) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              </svg>
            </>
          )}
        </section>

        {/* Report-data action */}
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4"
          aria-labelledby="report-data-heading"
        >
          <div>
            <h2
              id="report-data-heading"
              className="text-sm font-semibold text-foreground"
            >
              Something look wrong?
            </h2>
            <p className="text-xs text-muted-foreground">
              Report incorrect provider data. Reports are reviewed by our team and
              do not change data instantly.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReportOpen(true)}
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            Report data
          </Button>
        </section>

        <ReportDataDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          providerId={providerId ?? ""}
          defaultPageContext={`Provider profile · ${selectedRange.label} performance`}
        />

        {/* Covered assets */}
        <ProviderCoveredAssets
          assets={coveredAssets}
          isLoading={providerLoading}
          providerId={providerId ?? ""}
        />

        {/* Signals with active / archived / combined scope */}
        <section
          className="rounded-lg border border-gray-800 bg-gray-900 p-4"
          aria-labelledby="provider-signals-heading"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2
              id="provider-signals-heading"
              className="text-sm font-semibold text-foreground"
            >
              Signals
            </h2>
            <div
              role="group"
              aria-label="Filter signals by status"
              className="flex gap-1"
            >
              {SIGNAL_SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setScope(option.key)}
                  aria-pressed={scope === option.key}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    scope === option.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {signalsLoading ? (
            <ListStateIndicator
              state="loading"
              label={`Loading ${SIGNAL_SCOPE_LABELS[scope]} signals`}
            />
          ) : signalsError ? (
            <DataPanelError
              title="Couldn't load signals"
              description={`We couldn't load ${SIGNAL_SCOPE_LABELS[scope]} signals for this provider.`}
              onRetry={() => refetchSignals()}
            />
          ) : signals.length === 0 ? (
            <SignalEmptyState scope={scope} />
          ) : (
            <>
              {signalsFetching && (
                <ListStateIndicator
                  state="refreshing"
                  label={`Refreshing ${SIGNAL_SCOPE_LABELS[scope]} signals`}
                />
              )}
              <ul className="flex flex-col gap-2">
                {paginatedSignals.map((signal) => (
                  <li
                    key={signal.id}
                    className="rounded border border-gray-800 bg-gray-950 p-3 text-sm text-foreground"
                  >
                    {signal.asset ?? "Unknown asset"}
                  </li>
                ))}
              </ul>
              <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                canGoPrevious={canGoPrevious}
                canGoNext={canGoNext}
                onPrevious={goToPrevious}
                onNext={goToNext}
              />
            </>
          )}
        </section>
      </main>
    </PageTransition>
  );
}
