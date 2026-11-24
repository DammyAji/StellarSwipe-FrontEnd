'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import ListStateIndicator from './ListStateIndicator';
import DataPanelError from './DataPanelError';
import NetworkErrorState from './NetworkErrorState';

export interface ProviderCoveredAssetsProps {
  assets?: string[];
  isLoading?: boolean;
  error?: unknown;
}

function normalizeAssets(assets?: string[]): string[] {
  if (!assets || assets.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const asset of assets) {
    if (typeof asset !== 'string') {
      continue;
    }
    const trimmed = asset.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toUpperCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  result.sort((a, b) => a.localeCompare(b));
  return result;
}

export default function ProviderCoveredAssets({
  assets,
  isLoading = false,
  error,
}: ProviderCoveredAssetsProps) {
  const normalizedAssets = useMemo(() => normalizeAssets(assets), [assets]);

  const hasError = Boolean(error);

  return (
    <section
      className="provider-covered-assets"
      aria-labelledby="provider-covered-assets-heading"
    >
      <h2
        id="provider-covered-assets-heading"
        className="provider-covered-assets__heading"
      >
        Covered assets
      </h2>

      {isLoading ? (
        <ListStateIndicator
          state="loading"
          label="Loading covered assets"
        />
      ) : hasError ? (
        <div className="provider-covered-assets__error">
          <DataPanelError
            title="Unable to load covered assets"
            description="We couldn't retrieve this provider's asset coverage. Please try again."
          />
          <NetworkErrorState
            message="Failed to load covered assets."
            onRetry={undefined}
          />
        </div>
      ) : normalizedAssets.length === 0 ? (
        <p
          className="provider-covered-assets__empty"
          role="status"
        >
          No asset coverage recorded yet
        </p>
      ) : (
        <ul
          className="provider-covered-assets__list"
          aria-label="Covered assets"
        >
          {normalizedAssets.map((asset) => (
            <li
              key={asset}
              className="provider-covered-assets__item"
            >
              <Link
                href={`/markets?asset=${encodeURIComponent(asset)}`}
                className="provider-covered-assets__chip"
                aria-label={`View markets for asset ${asset}`}
              >
                {asset}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}