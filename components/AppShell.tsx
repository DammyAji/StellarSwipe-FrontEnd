"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { useTransactionStore } from "@/store/useTransactionStore";
import { Button } from "@/components/ui/button";
import { WalletDropdown } from "@/components/WalletDropdown";
import { PageTransition } from "@/components/PageTransition";
import { PortfolioSummaryCards } from "@/components/PortfolioSummaryCards";
import { OnChainConfirmationStatus } from "@/components/OnChainConfirmationStatus";
import { TransactionActivityFeed } from "@/components/TransactionActivityFeed";
import { PositionStopLossControl } from "@/components/PositionStopLossControl";
import { NetworkErrorState } from "@/components/NetworkErrorState";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SignalCard } from "@/components/SignalCard";
import { usePortfolio } from "@/hooks/usePortfolio";
import { PortfolioErrorBoundary } from "@/components/PortfolioErrorBoundary";
import { SignalFeedErrorBoundary } from "@/components/signal/SignalFeedErrorBoundary";
import { useFocusReturn } from "@/hooks/useFocusReturn";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { RestartWalkthroughButton } from "@/components/RestartWalkthroughButton";

// Heavy/optional panels deferred out of the initial /app bundle — they're
// not needed for first paint (modals only open on interaction, charts and
// onboarding are secondary to the signal feed itself).
const TradeModal = dynamic(
  () => import("@/components/TradeModal").then((m) => m.TradeModal),
  { ssr: false }
);
const WalletSelectionModal = dynamic(
  () =>
    import("@/components/WalletSelectionModal").then(
      (m) => m.WalletSelectionModal
    ),
  { ssr: false }
);
const DashboardWidgets = dynamic(
  () => import("@/components/DashboardWidgets").then((m) => m.DashboardWidgets),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-2xl bg-white/5" />
    ),
  }
);
const OnboardingFlow = dynamic(
  () => import("@/components/OnboardingFlow").then((m) => m.OnboardingFlow),
  { ssr: false }
);

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { publicKey, connected } = useWallet();
  const { assets } = usePortfolio();
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const pendingTransaction = useTransactionStore((state) =>
    state.history.find((item) => item.status === "PENDING")
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [marketPrice, setMarketPrice] = useState(0.4821);
  const [loading, setLoading] = useState(false);

  const handleTrade = (pair: string, price: number) => {
    setMarketPrice(price);
    addTransaction({
      id: `tx-${Date.now()}`,
      hash: `${Date.now().toString(16)}${pair.replace(/[^a-zA-Z0-9]/g, "")}`,
      assetPair: pair,
      amount: "100",
      price: price.toFixed(4),
      fee: "0.0004",
      token: "XLM",
      timestamp: Date.now(),
      type: "SWAP",
      status: "PENDING",
      outcome: "PENDING",
    });
  };

  const toggleLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2500);
  };

  const portfolioBalance = useMemo(
    () => assets.reduce((sum, a) => sum + a.value, 0),
    [assets]
  );

  const prefersReduced = useReducedMotion();
  const { isOnline } = useNetworkStatus();

  // Restore focus to the triggering element when each overlay closes.
  useFocusReturn(modalOpen);
  useFocusReturn(walletModalOpen);

  if (!connected) {
    return (
      <PageTransition>
        <OnboardingFlow />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4 text-foreground sm:gap-8 sm:p-8"
        >
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -20 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={prefersReduced ? { duration: 0.01 } : { duration: 0.5 }}
            className="relative text-center"
          >
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              StellarSwipe
            </h1>
            <p className="mt-2 text-foreground-muted">
              Connect your Freighter wallet to get started
            </p>
          </motion.div>

          <motion.div
            initial={
              prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }
            }
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={
              prefersReduced
                ? { duration: 0.01 }
                : { delay: 0.2, duration: 0.4 }
            }
            className="flex flex-col items-center gap-4"
          >
            <Button
              onClick={() => setWalletModalOpen(true)}
              size="lg"
              className="focus:ring-2 focus:ring-blue-500"
            >
              Connect Wallet
            </Button>
          </motion.div>

          <WalletSelectionModal
            open={walletModalOpen}
            onClose={() => setWalletModalOpen(false)}
          />
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-6 sm:py-8 lg:px-8"
      >
        <header className="mx-auto mb-6 flex w-full max-w-7xl items-center justify-between gap-3 sm:mb-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            StellarSwipe
          </h1>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-mono text-foreground-muted sm:block">
              {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}
            </p>
            <PrivacyToggle size="sm" />
            <RestartWalkthroughButton />
            <WalletDropdown />
          </div>
        </header>

        {!isOnline && (
          <div className="mx-auto mb-4 w-full max-w-7xl">
            <NetworkErrorState
              context="the dashboard"
              onRetry={() => window.location.reload()}
              variant="banner"
            />
          </div>
        )}

        <div className="mx-auto mb-4 w-full max-w-7xl">
          <OnChainConfirmationStatus
            transactionHash={pendingTransaction?.hash}
            status={pendingTransaction?.status}
          />
        </div>

        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
            <div className="flex min-w-0 flex-col gap-4">
              {/* Signal feed streamed in via Suspense */}
              <SignalFeedErrorBoundary>
                <div className="min-w-0">{children}</div>
              </SignalFeedErrorBoundary>

              <PortfolioErrorBoundary>
                <div className="flex w-full max-w-md flex-col items-center gap-3 px-4 sm:px-0">
                  <SignalCard
                    loading={loading}
                    onTrade={handleTrade}
                    providerStake={50000}
                    providerReputation={85}
                    walletMissing={!connected}
                    portfolioBalance={portfolioBalance}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={toggleLoading}
                      className="text-xs text-foreground-subtle hover:text-foreground-muted underline transition-colors"
                    >
                      Preview skeleton
                    </button>
                    <button
                      onClick={() => setModalOpen(true)}
                      className="text-xs text-foreground-subtle hover:text-foreground-muted underline transition-colors"
                    >
                      Open trade modal
                    </button>
                  </div>
                </div>
              </PortfolioErrorBoundary>

              <div className="w-full max-w-md">
                <PositionStopLossControl />
              </div>

              <div className="w-full">
                <TransactionActivityFeed />
              </div>
            </div>
            {/* Right Column: Dashboard widgets */}
            <div className="w-full flex flex-col gap-6">
              <DashboardWidgets />
            </div>
          </div>
        </div>

        <TradeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          marketPrice={marketPrice}
          walletBalance={250}
          portfolioBalance={portfolioBalance}
        />
      </main>
    </PageTransition>
  );
}
