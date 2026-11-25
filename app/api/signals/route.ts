import { NextResponse } from "next/server";
import {
  buildSignalCursorPage,
  buildSignalPage,
  buildActivitySummary,
  buildConfidenceHistory,
  buildProviderActivityTimeline,
  decodeSignalCursor,
  parseSignalFeedFilters,
} from "@/lib/signals";
import { traceWorker } from "@/src/tracing/worker-tracing.service";
import { getRequestUserId } from "@/lib/providerFollows";
import { dismissSignal, isSignalDismissalReason } from "@/lib/signalState";
import {
  consumeRateLimit,
  getRateLimitIdentity,
  rateLimitResponse,
} from "@/lib/rateLimit";
import { applyCorsHeaders } from "@/lib/cors";

const SIGNALS_ALLOWED_METHODS = ["GET", "POST", "OPTIONS"];
const SIGNALS_ALLOWED_HEADERS = ["Content-Type", "Authorization"];

// Read state is tracked per user, independently from bookmarks and dismissal.
const readSignalsByUser = new Map<string, Set<string>>();

function getReadSignals(userId: string): Set<string> {
  let read = readSignalsByUser.get(userId);
  if (!read) {
    read = new Set<string>();
    readSignalsByUser.set(userId, read);
  }
  return read;
}

function isSignalRead(userId: string | null, signalId: string): boolean {
  if (!userId) return false;
  return getReadSignals(userId).has(signalId);
}

function markSignalRead(userId: string, signalId: string): void {
  getReadSignals(userId).add(signalId);
}

function withCors(request: Request, response: NextResponse) {
  return applyCorsHeaders(request, response, {
    methods: SIGNALS_ALLOWED_METHODS,
    headers: SIGNALS_ALLOWED_HEADERS,
  });
}

export async function OPTIONS(request: Request) {
  return withCors(request, new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request) {
  const userId = getRequestUserId(request);
  const identity = getRateLimitIdentity(request, userId);
  const throttled = rateLimitResponse(
    consumeRateLimit("signals:read", identity)
  );
  if (throttled) return throttled;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "10");
  const view = url.searchParams.get("view");
  const signalId = url.searchParams.get("signalId");
  const providerId = url.searchParams.get("providerId");

  if (
    Number.isNaN(page) ||
    page < 1 ||
    Number.isNaN(pageSize) ||
    pageSize < 1
  ) {
    return withCors(
      request,
      NextResponse.json(
        {
          error:
            "Invalid pagination parameters. page and pageSize must be positive integers.",
        },
        { status: 400 }
      )
    );
  }

  if (view === "activity") {
    const activity = await traceWorker(
      "worker:signals:activity",
      async () => buildActivitySummary(page, pageSize),
      { page, pageSize }
    );

    return withCors(request, NextResponse.json(activity, { status: 200 }));
  }

  if (view === "provider-timeline") {
    if (!providerId) {
      return NextResponse.json(
        { error: "providerId is required to load a provider activity timeline." },
        { status: 400 }
      );
    }

    const timeline = await traceWorker(
      "worker:signals:provider-timeline",
      async () => buildProviderActivityTimeline(providerId, page, pageSize),
      { providerId, page, pageSize }
    );

    return NextResponse.json(timeline, { status: 200 });
  }

  if (view === "confidence-history") {
    if (!signalId) {
      return withCors(
        request,
        NextResponse.json(
          { error: "signalId is required to load confidence history." },
          { status: 400 }
        )
      );
    }

    const history = await traceWorker(
      "worker:signals:confidence-history",
      async () => buildConfidenceHistory(signalId),
      { signalId }
    );

    return withCors(request, NextResponse.json(history, { status: 200 }));
  }

  const filters = parseSignalFeedFilters(url.searchParams);
  if (!filters) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Invalid filter parameters. action and status must be known values." },
        { status: 400 }
      )
    );
  }

  // Presence of `cursor` selects cursor mode; an empty value requests the first page.
  if (url.searchParams.has("cursor")) {
    if (url.searchParams.has("page")) {
      return withCors(
        request,
        NextResponse.json(
          { error: "Use either cursor or page, not both." },
          { status: 400 }
        )
      );
    }

    const cursor = url.searchParams.get("cursor") ?? "";
    const after = cursor ? decodeSignalCursor(cursor) : null;
    if (cursor && !after) {
      return withCors(
        request,
        NextResponse.json(
          { error: "Invalid cursor." },
          { status: 400 }
        )
      );
    }

    const cursorFeed = await traceWorker(
      "worker:signals:fetch",
      async () => buildSignalCursorPage(after, pageSize, filters),
      { pageSize, filters }
    );

    return withCors(request, NextResponse.json(cursorFeed, { status: 200 }));
  }

  const feed = await traceWorker(
    "worker:signals:fetch",
    async () => buildSignalPage(page, pageSize, filters),
    { page, pageSize, filters }
  );

  return withCors(request, NextResponse.json(feed, { status: 200 }));
}

/**
 * POST /api/signals
 *
 * Dismisses a signal for the authenticated user, or marks it as read when
 * `action` is "read". Read state is tracked independently from bookmarks and
 * dismissal.
 *
 * Body: { signalId: string; reason?: string; action?: "dismiss" | "read" }
 */
export async function POST(request: Request) {
  const userId = getRequestUserId(request);

  if (!userId) {
    return withCors(
      request,
      NextResponse.json({ error: "Authentication required" }, { status: 401 })
    );
  }

  const identity = getRateLimitIdentity(request, userId);
  const throttled = rateLimitResponse(
    consumeRateLimit("signals:write", identity)
  );
  if (throttled) return throttled;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withCors(
      request,
      NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      )
    );
  }

  const payload = (body ?? {}) as {
    signalId?: unknown;
    reason?: unknown;
    action?: unknown;
  };

  const signalId =
    typeof payload.signalId === "string" ? payload.signalId.trim() : "";

  if (!signalId) {
    return withCors(
      request,
      NextResponse.json(
        { error: "signalId is required to update a recommendation." },
        { status: 400 }
      )
    );
  }

  // Marking a signal read is independent from dismissal and bookmarks.
  if (payload.action === "read") {
    const read = await traceWorker(
      "worker:signals:read",
      async () => {
        markSignalRead(userId, signalId);

        return {
          signalId,
          read: true,
        };
      },
      { signalId }
    );

    return withCors(request, NextResponse.json(read, { status: 200 }));
  }

  // Feedback is optional: skipping the reason must not block dismissal.
  const reason = isSignalDismissalReason(payload.reason) ? payload.reason : null;

  // Idempotent: re-dismissing returns the original dismissal record.
  const dismissal = await traceWorker(
    "worker:signals:dismiss",
    async () => {
      const stored = dismissSignal(userId, signalId, reason);

      return {
        signalId,
        dismissed: true,
        reason: stored.reason,
      };
    },
    { signalId, reason }
  );

  return withCors(request, NextResponse.json(dismissal, { status: 200 }));
}
