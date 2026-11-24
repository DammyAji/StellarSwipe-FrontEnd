"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RECOMMENDATION_FACTORS,
  type RecommendationFactor,
} from "@/services/recommendationEngine";
import { EvidenceLinks } from "@/components/EvidenceLinks";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; factor: RecommendationFactor }
  | { status: "unavailable" }
  | { status: "error" };

/** Resolves a factor's detail. Async so a remote source can slot in later. */
async function loadFactorDetail(
  id: string
): Promise<RecommendationFactor | null> {
  await Promise.resolve();
  const factor = RECOMMENDATION_FACTORS.find((f) => f.id === id);
  return factor && factor.description ? factor : null;
}

interface RecommendationFactorDrawerProps {
  /** Factor to show; `null` closes the drawer. */
  factorId: string | null;
  riskProfile: string;
  onClose: () => void;
}

/**
 * Side drawer showing the evidence behind a single recommendation factor.
 * Built on the Radix dialog, so focus is trapped while open and returned to
 * the triggering control on close. The surrounding list stays mounted.
 */
export function RecommendationFactorDrawer({
  factorId,
  riskProfile,
  onClose,
}: RecommendationFactorDrawerProps) {
  const [state, setState] = useState<DetailState>({ status: "loading" });

  const load = useCallback(async (id: string, isCancelled: () => boolean) => {
    setState({ status: "loading" });
    try {
      const factor = await loadFactorDetail(id);
      if (isCancelled()) return;
      setState(factor ? { status: "ready", factor } : { status: "unavailable" });
    } catch {
      if (!isCancelled()) setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    if (!factorId) return;
    let cancelled = false;
    load(factorId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [factorId, load]);

  return (
    <Dialog open={factorId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="left-auto right-0 top-0 h-full max-w-md translate-x-0 translate-y-0 content-start overflow-y-auto sm:rounded-none data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100">
        {state.status === "loading" && (
          <>
            <DialogTitle>Loading factor</DialogTitle>
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Loading factor details…
            </div>
          </>
        )}

        {state.status === "unavailable" && (
          <>
            <DialogTitle>Details unavailable</DialogTitle>
            <DialogDescription>
              There is no additional explanation for this factor yet.
            </DialogDescription>
          </>
        )}

        {state.status === "error" && (
          <>
            <DialogTitle>Couldn&apos;t load factor</DialogTitle>
            <div role="alert" className="flex gap-2 text-sm text-red-500">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Something went wrong while loading this factor.
            </div>
            <button
              type="button"
              onClick={() => factorId && load(factorId, () => false)}
              className="justify-self-start rounded-md border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Try again
            </button>
          </>
        )}

        {state.status === "ready" && (
          <>
            <DialogTitle>{state.factor.label}</DialogTitle>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Value</dt>
                <dd className="mt-1 font-mono">{state.factor.weight}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Explanation
                </dt>
                <DialogDescription asChild>
                  <dd className="mt-1 text-foreground">
                    {state.factor.description}
                  </dd>
                </DialogDescription>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Supporting evidence
                </dt>
                <dd className="mt-1">
                  {state.factor.evidence && state.factor.evidence.length > 0 ? (
                    <EvidenceLinks evidence={state.factor.evidence} />
                  ) : (
                    <p className="text-muted-foreground">
                      No supporting evidence available.
                    </p>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Source</dt>
                <dd className="mt-1 flex gap-2 text-muted-foreground">
                  <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Scored locally in your browser using your{" "}
                    <span className="font-medium capitalize">{riskProfile}</span>{" "}
                    risk profile.
                  </span>
                </dd>
              </div>
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
