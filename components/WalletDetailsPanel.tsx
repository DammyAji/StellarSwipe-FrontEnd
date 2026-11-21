"use client";

import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getNetworkLabel } from "@/lib/assetIssuer";
import { useWalletStore } from "@/store/useWalletStore";

export interface WalletDetailsPanelProps {
  /** True while the wallet connection is being established. */
  isLoading?: boolean;
  /** Connection failure message; when set the panel shows an error state. */
  error?: string | null;
  /** Retry handler for the error state. */
  onRetry?: () => void;
  className?: string;
}

/**
 * WalletDetailsPanel (#1079)
 *
 * Read-only summary of the connected wallet: full public address, active
 * network and active-wallet state. Copying the address uses the clipboard
 * only — it never asks the wallet to sign anything.
 *
 * Unavailable data is never presented as fact: a missing address or network
 * is reported as "Not available" instead of being guessed.
 */
export function WalletDetailsPanel({
  isLoading = false,
  error = null,
  onRetry,
  className,
}: WalletDetailsPanelProps) {
  const publicKey = useWalletStore((s) => s.publicKey);
  const activePublicKey = useWalletStore((s) => s.activePublicKey);
  const isConnected = useWalletStore((s) => s.isConnected);
  const network = useWalletStore((s) => s.network);

  const address = publicKey ?? activePublicKey ?? null;
  const hasNetwork = typeof network === "string" && network.trim().length > 0;
  const isActive = Boolean(isConnected && address);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-blue-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">
            Wallet Details
          </h2>
        </div>
        <p className="text-xs text-foreground-muted">
          The wallet currently connected to StellarSwipe. Copying the address
          never triggers a signing request.
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading ? (
          <LoadingState variant="inline" label="Loading wallet details…" />
        ) : error ? (
          <ErrorState
            title="Wallet details unavailable"
            description={error}
            onRetry={onRetry}
          />
        ) : !address ? (
          <EmptyState
            title="No wallet connected"
            description="Connect a Stellar wallet to see its address and network here."
            icon={<Wallet size={24} className="text-foreground-muted" aria-hidden="true" />}
            className="px-4 py-8"
          />
        ) : (
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Public address
              </dt>
              <dd>
                <CopyField
                  value={address}
                  truncate={false}
                  label="wallet address"
                />
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Network
              </dt>
              <dd className="text-sm text-foreground">
                {hasNetwork ? (
                  getNetworkLabel(network)
                ) : (
                  <span className="text-foreground-muted">Not available</span>
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Active wallet
              </dt>
              <dd className="flex items-center gap-2 text-sm text-foreground">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    isActive ? "bg-green-500" : "bg-foreground-muted/40"
                  }`}
                />
                <span>{isActive ? "Active" : "Inactive"}</span>
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
