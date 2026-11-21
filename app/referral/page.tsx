"use client";

import React, { useMemo, useState } from "react";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Milestone definitions (#350)
// ---------------------------------------------------------------------------
export interface ReferralMilestone {
  threshold: number;
  reward: string;
  label: string;
}

export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  { threshold: 5, reward: "$10 credit", label: "Starter" },
  { threshold: 10, reward: "$25 credit + badge", label: "Advocate" },
  { threshold: 25, reward: "$75 credit + premium month", label: "Champion" },
  { threshold: 50, reward: "$200 credit + VIP access", label: "Legend" },
];

/** Returns the next milestone the user hasn't yet reached, or null if all done. */
export function getNextMilestone(
  count: number
): ReferralMilestone | null {
  return REFERRAL_MILESTONES.find((m) => count < m.threshold) ?? null;
}

/** Returns the last milestone the user has reached, or null if none. */
export function getReachedMilestone(
  count: number
): ReferralMilestone | null {
  const reached = REFERRAL_MILESTONES.filter((m) => count >= m.threshold);
  return reached.length > 0 ? reached[reached.length - 1] : null;
}

/**
 * Calculates progress (0–100) toward the next milestone.
 * The progress is relative to the span between the previous milestone
 * threshold and the next one.
 */
export function calcMilestoneProgress(count: number): number {
  const next = getNextMilestone(count);
  if (!next) return 100; // all milestones completed

  const nextIdx = REFERRAL_MILESTONES.indexOf(next);
  const prevThreshold =
    nextIdx === 0 ? 0 : REFERRAL_MILESTONES[nextIdx - 1].threshold;
  const span = next.threshold - prevThreshold;
  const earned = count - prevThreshold;
  return Math.min(100, Math.max(0, (earned / span) * 100));
}

// ---------------------------------------------------------------------------
// Referral rewards progress tracker (#834)
// ---------------------------------------------------------------------------
export type ReferralStage = "pending" | "completed" | "ineligible";

export interface Referral {
  /** Stable identifier for the referral. */
  id: string;
  /** Current stage of the referral in the invite → reward flow. */
  stage: ReferralStage;
  /**
   * Human-readable description of what still needs to happen before the
   * referral qualifies for its reward. Only present while the referral is
   * still pending; omitted once it is completed or ineligible.
   */
  nextRequirement?: string;
}

/** Plain-language explanation for each referral stage. */
export const REFERRAL_STAGE_LABELS: Record<ReferralStage, string> = {
  pending: "Pending",
  completed: "Completed",
  ineligible: "Ineligible",
};

export const REFERRAL_STAGE_DESCRIPTIONS: Record<ReferralStage, string> = {
  pending:
    "Your invite was sent. This referral is waiting to meet the qualification requirement below.",
  completed:
    "This referral qualified and the reward has been credited to your account.",
  ineligible:
    "This referral can no longer qualify for a reward. No further action is needed.",
};

/**
 * Returns the plain-language explanation for a referral's current stage.
 * Falls back to a neutral message for unknown stages so the tracker never
 * renders an empty or misleading state.
 */
export function getReferralStageDescription(stage: ReferralStage): string {
  return (
    REFERRAL_STAGE_DESCRIPTIONS[stage] ??
    "This referral's status is currently unavailable."
  );
}

/**
 * Returns the next qualification requirement for a referral, or null when
 * there is nothing left to qualify (completed/ineligible) or when the
 * requirement metadata is missing.
 */
export function getNextRequirement(
  referral: Referral
): string | null {
  if (referral.stage !== "pending") return null;
  const requirement = referral.nextRequirement?.trim();
  return requirement ? requirement : null;
}

const STAGE_STYLES: Record<ReferralStage, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-green-500/15 text-green-300 border-green-500/30",
  ineligible: "bg-white/10 text-white/60 border-white/20",
};

function ReferralProgressTracker({ referrals }: { referrals: Referral[] }) {
  if (referrals.length === 0) {
    return (
      <div
        className="bg-white/5 p-4 rounded mb-4 text-sm text-white/60"
        role="region"
        aria-label="Referral rewards progress tracker"
      >
        No referrals yet. Share your link to start tracking progress.
      </div>
    );
  }

  return (
    <div
      className="bg-white/5 p-4 rounded mb-4"
      role="region"
      aria-label="Referral rewards progress tracker"
    >
      <h2 className="text-sm font-semibold mb-3">
        Referral rewards progress
      </h2>
      <ul className="space-y-3">
        {referrals.map((referral) => {
          const requirement = getNextRequirement(referral);
          return (
            <li
              key={referral.id}
              className="border border-white/10 rounded p-3"
              data-testid={`referral-${referral.id}`}
              data-stage={referral.stage}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  Referral {referral.id}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${STAGE_STYLES[referral.stage]}`}
                  data-testid={`referral-${referral.id}-stage`}
                >
                  {REFERRAL_STAGE_LABELS[referral.stage] ?? referral.stage}
                </span>
              </div>
              <p className="text-xs text-white/60 mt-1">
                {getReferralStageDescription(referral.stage)}
              </p>
              {referral.stage === "pending" && (
                <p
                  className="text-xs text-white/80 mt-1"
                  data-testid={`referral-${referral.id}-requirement`}
                >
                  {requirement
                    ? `Next step: ${requirement}`
                    : "Next step: qualification details are not available yet."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UTM link helpers
// ---------------------------------------------------------------------------
const BASE_REFERRAL_URL = "https://app.example.com/referral/ABC123";

const UTM_CHANNELS = [
  { key: "twitter", label: "Twitter", source: "twitter", medium: "social" },
  { key: "telegram", label: "Telegram", source: "telegram", medium: "social" },
  {
    key: "whatsapp",
    label: "WhatsApp",
    source: "whatsapp",
    medium: "messaging",
  },
  { key: "email", label: "Email", source: "email", medium: "email" },
] as const;

type ChannelKey = (typeof UTM_CHANNELS)[number]["key"];

function buildReferralLink(baseUrl: string, channel: ChannelKey): string {
  const ch = UTM_CHANNELS.find((c) => c.key === channel);
  if (!ch) return baseUrl;
  const params = new URLSearchParams({
    utm_source: ch.source,
    utm_medium: ch.medium,
    utm_campaign: "referral",
    utm_content: channel,
  });
  return `${baseUrl}?${params.toString()}`;
}

const SHARE_TEXT = "Join me on StellarSwipe";

/** Builds each channel's share URL from a single, once-encoded referral link. */
export function buildShareUrl(channel: ChannelKey, link: string): string {
  const url = encodeURIComponent(link);
  const text = encodeURIComponent(SHARE_TEXT);
  switch (channel) {
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    case "telegram":
      return `https://t.me/share/url?url=${url}&text=${text}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${link}`)}`;
    case "email":
      return `mailto:?subject=${text}&body=${url}`;
  }
}

type CopyStatus = "idle" | "copied" | "failed";

function useCopyStatus() {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 3000);
  };
  return { status, copy };
}

function ReferralShareDialog({
  triggerLabel = "Share",
  triggerClassName = "px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors",
}: {
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const { status, copy } = useCopyStatus();
  const [shareError, setShareError] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const nativeShare = async () => {
    setShareError(false);
    const link = buildReferralLink(BASE_REFERRAL_URL, "twitter");
    try {
      await navigator.share({ title: SHARE_TEXT, url: link });
    } catch (err) {
      // User cancelling the sheet is not a failure
      if ((err as Error)?.name !== "AbortError") setShareError(true);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={triggerClassName}
          data-testid="share-dialog-trigger"
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share your referral link</DialogTitle>
          <DialogDescription>
            Pick a channel or copy the link. Each channel gets its own tracked
            link.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {canNativeShare && (
            <button
              onClick={nativeShare}
              className="col-span-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 rounded text-sm"
            >
              Share via device…
            </button>
          )}
          {UTM_CHANNELS.map((ch) => (
            <a
              key={ch.key}
              href={buildShareUrl(
                ch.key,
                buildReferralLink(BASE_REFERRAL_URL, ch.key)
              )}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`share-${ch.key}`}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-sm text-center"
            >
              {ch.label}
            </a>
          ))}
        </div>
        <input
          readOnly
          value={BASE_REFERRAL_URL}
          onFocus={(e) => e.currentTarget.select()}
          className="bg-black/20 px-3 py-2 rounded text-sm font-mono"
          aria-label="Referral link"
        />
        <button
          onClick={() => copy(BASE_REFERRAL_URL)}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-sm"
          data-testid="share-copy-link"
        >
          Copy link
        </button>
        <p
          role="status"
          className={`text-xs min-h-4 ${
            status === "failed" || shareError ? "text-red-400" : "text-green-400"
          }`}
        >
          {status === "copied" && "Link copied to clipboard."}
          {status === "failed" &&
            "Couldn't copy automatically. Select the link field and copy it manually."}
          {status === "idle" &&
            shareError &&
            "Sharing failed. Try a channel above or copy the link."}
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Milestone Progress Bar component
// ---------------------------------------------------------------------------
function MilestoneProgressBar({ referralCount }: { referralCount: number }) {
  const nextMilestone = getNextMilestone(referralCount);
  const reachedMilestone = getReachedMilestone(referralCount);
  const progress = calcMilestoneProgress(referralCount);
  const allComplete = !nextMilestone;

  // Celebratory state: freshly hit a milestone exactly
  const isNewlyReached = REFERRAL_MILESTONES.some(
    (m) => m.threshold === referralCount
  );

  return (
    <div
      className="bg-white/5 p-4 rounded mb-4"
      role="region"
      aria-label="Referral milestone progress"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {allComplete
            ? "All milestones reached"
            : `Next: ${nextMilestone.label} (${nextMilestone.threshold} referrals)`}
        </span>
        <span className="text-xs text-white/60">
          {reachedMilestone
            ? `Current: ${reachedMilestone.label}`
            : "No milestone yet"}
        </span>
      </div>
      <div
        className="h-2 bg-black/30 rounded overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full bg-purple-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-white/60 mt-2">
        {allComplete
          ? "You've unlocked every referral reward."
          : `${referralCount} of ${nextMilestone.threshold} referrals toward ${nextMilestone.reward}.`}
      </p>
      {isNewlyReached && (
        <p className="text-xs text-green-400 mt-1" role="status">
          Milestone reached! Reward unlocked.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const SAMPLE_REFERRALS: Referral[] = [
  {
    id: "ABC123",
    stage: "pending",
    nextRequirement: "Complete their first trade",
  },
  { id: "DEF456", stage: "completed" },
  { id: "GHI789", stage: "ineligible" },
];

const PRIMARY_CTA_CLASS =
  "w-full sm:w-auto px-5 py-3 bg-purple-500 hover:bg-purple-600 rounded-md text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border forced-colors:border-[ButtonText]";

const TRUST_POINTS = [
  "Rewards are credited automatically once a referral qualifies.",
  "You can track every invite and its status on this page.",
  "Your referral link never expires.",
];

export default function ReferralPage() {
  const referralCount = useMemo(
    () => SAMPLE_REFERRALS.filter((r) => r.stage === "completed").length,
    []
  );

  return (
    <RouteErrorBoundary>
      <main className="min-h-screen bg-black text-white p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold mb-4">Referrals</h1>

          <section
            className="bg-white/5 p-4 sm:p-6 rounded mb-4"
            aria-labelledby="referral-cta-heading"
          >
            <h2 id="referral-cta-heading" className="text-lg font-semibold">
              Invite friends, earn rewards
            </h2>
            <p className="text-sm text-white/70 mt-2">
              Share your personal link with people who trade on StellarSwipe.
              When they join and complete their first trade, you earn account
              credit — and they get a head start too.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <ReferralShareDialog
                triggerLabel="Invite a friend"
                triggerClassName={PRIMARY_CTA_CLASS}
              />
              <p className="text-xs text-white/60">
                Takes less than a minute. No limit on how many people you invite.
              </p>
            </div>
            <ul className="mt-4 space-y-1 text-xs text-white/60">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden="true" className="text-green-400">
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <MilestoneProgressBar referralCount={referralCount} />
          <ReferralProgressTracker referrals={SAMPLE_REFERRALS} />
        </div>
      </main>
    </RouteErrorBoundary>
  );
}
