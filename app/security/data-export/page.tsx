"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  DownloadCloud,
  FileClock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ExportStatus = "pending" | "processing" | "ready" | "canceled";

const ACTIVE_STATUSES: ExportStatus[] = ["pending", "processing"];

const STATUS_LABELS: Record<ExportStatus, string> = {
  pending: "Queued",
  processing: "In progress",
  ready: "Ready",
  canceled: "Canceled",
};

const STATUS_STYLES: Record<ExportStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  processing: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  canceled: "border-white/20 bg-white/5 text-foreground-muted",
};

interface ExportRequest {
  id: string;
  requestedAt: string;
  status: ExportStatus;
  downloadUrl?: string;
  downloadFileName?: string;
}

const EXPORT_STORAGE_KEY = "account-data-export-requests";
const EXPORT_TIMINGS = {
  pending: 0,
  processing: 2500,
  ready: 4000,
} as const;

const INCLUDED_CATEGORIES = [
  "Profile and account details",
  "Security and login history",
  "App settings and preferences",
  "Journal notes and annotations",
  "Referral and reward records",
  "Audit history and support interactions",
];

function readRequests(): ExportRequest[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(EXPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExportRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRequests(requests: ExportRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify(requests));
}

function buildExportPayload(requestedAt: string) {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      requestedAt,
      exportType: "full-account-data",
      includedCategories: INCLUDED_CATEGORIES,
      summary: {
        profile: true,
        settings: true,
        journalEntries: true,
        referralData: true,
        auditHistory: true,
      },
    },
    null,
    2
  );
}

function createExportDownloadUrl(payload: string) {
  if (typeof window === "undefined") {
    return null;
  }

  if (typeof window.URL?.createObjectURL === "function") {
    return window.URL.createObjectURL(
      new Blob([payload], { type: "application/json" })
    );
  }

  return `data:application/json;charset=utf-8,${encodeURIComponent(payload)}`;
}

export default function DataExportRequestPage() {
  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const timersRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    setRequests(readRequests());
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach((ids) =>
        ids.forEach((id) => window.clearTimeout(id))
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      if (downloadUrl && typeof window.URL?.revokeObjectURL === "function") {
        window.URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const latestRequest = useMemo(
    () =>
      requests
        .slice()
        .sort(
          (a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt)
        )[0] ?? null,
    [requests]
  );

  const hasActiveRequest = Boolean(
    latestRequest && ACTIVE_STATUSES.includes(latestRequest.status)
  );

  const updateRequest = (
    id: string,
    updater: (request: ExportRequest) => ExportRequest
  ) => {
    setRequests((current) => {
      const updated = current.map((request) =>
        request.id === id ? updater(request) : request
      );
      writeRequests(updated);
      return updated;
    });
  };

  const clearTimers = (id: string) => {
    const ids = timersRef.current[id];
    if (!ids) return;
    ids.forEach((timerId) => window.clearTimeout(timerId));
    delete timersRef.current[id];
  };

  const cancelExport = (id: string) => {
    clearTimers(id);
    updateRequest(id, (request) =>
      ACTIVE_STATUSES.includes(request.status)
        ? {
            ...request,
            status: "canceled" as ExportStatus,
            downloadUrl: undefined,
            downloadFileName: undefined,
          }
        : request
    );
  };

  const requestExport = () => {
    if (hasActiveRequest) {
      return;
    }

    const nextRequest: ExportRequest = {
      id: `export-${Date.now()}`,
      requestedAt: new Date().toISOString(),
      status: "pending",
    };

    const next = [nextRequest, ...requests].slice(0, 10);
    setRequests(next);
    writeRequests(next);

    const processingTimer = window.setTimeout(() => {
      updateRequest(nextRequest.id, (request) =>
        request.status === "pending"
          ? { ...request, status: "processing" as ExportStatus }
          : request
      );
    }, EXPORT_TIMINGS.processing);

    const readyTimer = window.setTimeout(() => {
      const payload = buildExportPayload(nextRequest.requestedAt);
      const objectUrl = createExportDownloadUrl(payload);

      setDownloadUrl((current) => {
        if (current && typeof window.URL?.revokeObjectURL === "function") {
          window.URL.revokeObjectURL(current);
        }
        return objectUrl;
      });

      updateRequest(nextRequest.id, (request) =>
        ACTIVE_STATUSES.includes(request.status)
          ? {
              ...request,
              status: "ready" as ExportStatus,
              downloadUrl: objectUrl ?? undefined,
              downloadFileName: `account-data-export-${new Date().toISOString()}.json`,
            }
          : request
      );
      delete timersRef.current[nextRequest.id];
    }, EXPORT_TIMINGS.ready);

    timersRef.current[nextRequest.id] = [processingTimer, readyTimer];
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8 text-foreground">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Account Data Export</h1>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">What is included</h2>
            <p className="text-xs text-foreground-muted">
              This export is prepared asynchronously and can take time depending
              on account activity. It is not an instant download.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
              {INCLUDED_CATEGORIES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Request export</h2>
            <p className="text-xs text-foreground-muted">
              You will receive a notification when your archive is ready. This
              is not an instant download.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <Button
              onClick={requestExport}
              className="gap-2"
              disabled={hasActiveRequest}
              aria-disabled={hasActiveRequest}
            >
              <DownloadCloud className="h-4 w-4" aria-hidden="true" />
              Request full account export
            </Button>

            {hasActiveRequest && latestRequest && (
              <div className="space-y-2">
                <p className="text-sm text-foreground-muted">
                  Another export request is already being prepared. You can cancel
                  it below or wait until it completes before requesting another
                  one.
                </p>
                <Button
                  variant="outline"
                  onClick={() => cancelExport(latestRequest.id)}
                  className="gap-2"
                  aria-label="Cancel in-progress account data export"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Cancel export
                </Button>
              </div>
            )}

            {latestRequest?.status === "ready" && latestRequest.downloadUrl && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Your export is ready.</span>
                </div>
                <a
                  href={latestRequest.downloadUrl}
                  download={latestRequest.downloadFileName}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 underline"
                  aria-label="Download account data export"
                >
                  <DownloadCloud className="h-4 w-4" aria-hidden="true" />
                  Download account data export
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Export status</h2>
            <p className="text-xs text-foreground-muted">
              Track current and recent data export requests.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {requests.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground-muted">
                No export requests yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {requests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    <span>
                      {new Date(request.requestedAt).toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[request.status]}`}
                      >
                        <FileClock className="h-3.5 w-3.5" aria-hidden="true" />
                        {STATUS_LABELS[request.status]}
                      </span>
                      {ACTIVE_STATUSES.includes(request.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelExport(request.id)}
                          className="gap-1 text-xs"
                          aria-label={`Cancel export requested ${new Date(
                            request.requestedAt
                          ).toLocaleString()}`}
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Cancel
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {latestRequest?.status === "pending" && (
              <p className="mt-3 text-xs text-foreground-muted">
                Your latest request has been received and will be processed
                asynchronously.
              </p>
            )}

            {latestRequest?.status === "processing" && (
              <p className="mt-3 text-xs text-foreground-muted">
                Your export is currently being assembled. This can take a few
                moments.
              </p>
            )}

            {latestRequest?.status === "ready" && (
              <p className="mt-3 text-xs text-foreground-muted">
                Your export is ready and can be downloaded from this page.
              </p>
            )}

            {latestRequest?.status === "canceled" && (
              <p className="mt-3 text-xs text-foreground-muted">
                Your latest export was canceled. No file was produced, so there is
                nothing to download. You can request a new export at any time.
              </p>
            )}
          </CardContent>
        </Card>

        <Button asChild variant="outline" className="gap-2">
          <Link href="/security">
            <ArrowLeft className="h-4 w-4 rtl-flip" aria-hidden="true" />
            Back to security settings
          </Link>
        </Button>
      </div>
    </main>
  );
}
