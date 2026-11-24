'use client';

import React from 'react';

export interface EvidenceItem {
  label: string;
  url: string;
}

export interface EvidenceLinksProps {
  evidence?: EvidenceItem[];
  loading?: boolean;
  error?: string | null;
}

/**
 * Validates an evidence URL and returns a safe href, or null if invalid.
 * Only http(s) URLs are considered safe for external linking.
 */
export function getSafeEvidenceUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export default function EvidenceLinks({ evidence, loading, error }: EvidenceLinksProps) {
  const safeItems = React.useMemo(() => {
    if (!evidence || evidence.length === 0) {
      return [];
    }
    return evidence
      .map((item) => {
        const href = getSafeEvidenceUrl(item?.url);
        if (!href) {
          return null;
        }
        const label = item?.label?.trim() || href;
        return { label, href };
      })
      .filter((item): item is { label: string; href: string } => item !== null);
  }, [evidence]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500" role="status">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
          aria-hidden="true"
        />
        <span>Loading evidence…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {error}
      </div>
    );
  }

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {safeItems.map((item, index) => (
        <li key={`${item.href}-${index}`} className="min-w-0 max-w-full">
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 break-words rounded text-blue-600 underline underline-offset-2 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span className="truncate">{item.label}</span>
            <span aria-hidden="true" className="shrink-0">
              ↗
            </span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}