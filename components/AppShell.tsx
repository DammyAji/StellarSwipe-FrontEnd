"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { useTransactionStore } from "@/store/useTransactionStore";
import { Button } from "@/components/ui/button";
import { TradeModal } from "@/components/TradeModal";
import { WalletSelectionModal } from "@/components/WalletSelectionModal";
import { WalletDropdown } from "@/components/WalletDropdown";
import { PageTransition } from "@/components/PageTransition";
import { PortfolioAllocationChart } from "@/components/chart/PortfolioAllocationChart";
import { PortfolioSummaryCards } from "@/components/PortfolioSummaryCards";
import { PnLWidget } from "@/components/chart/PnLWidget";
import { DashboardWidgets } from "@/components/DashboardWidgets";
import { OnChainConfirmationStatus } from "@/components/OnChainConfirmationStatus";
import { TransactionActivityFeed } from "@/components/TransactionActivityFeed";
import { PositionStopLossControl } from "@/components/PositionStopLossControl";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { SignalCard } from "@/components/SignalCard";
import { usePortfolio } from "@/hooks/usePortfolio";
import { PortfolioErrorBoundary } from "@/components/PortfolioErrorBoundary";
import { SignalFeedErrorBoundary } from "@/components/signal/SignalFeedErrorBoundary";

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

  if (!connected) {
    return (
      <PageTransition>
        <OnboardingFlow />
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:gap-8 sm:p-8 bg-background text-foreground">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative text-center"
          >
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              StellarSwipe
            </h1>
            <p className="mt-2 text-foreground-muted">Connect your Freighter wallet to get started</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
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
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8 text-foreground">
        <header className="mx-auto mb-6 flex w-full max-w-7xl items-center justify-between sm:mb-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">StellarSwipe</h1>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-mono text-foreground-muted sm:block">
              {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}
            </p>
            <WalletDropdown />
          </div>
        </header>

        <div className="mx-auto mb-4 w-full max-w-7xl">
          <OnChainConfirmationStatus
            transactionHash={pendingTransaction?.hash}
            status={pendingTransaction?.status}
          />
        </div>

        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
            <div className="flex flex-col gap-4 min-w-0">
              {/* Signal feed streamed in via Suspense */}
              <SignalFeedErrorBoundary>
                {children}
              </SignalFeedErrorBoundary>

              <PortfolioErrorBoundary>
                <div className="flex w-full max-w-md flex-col items-center gap-3 px-4 sm:px-0">
                  <SignalCard
                    loading={loading}
                    onTrade={handleTrade}
                    providerStake={50000}
                    providerReputation={85}
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
