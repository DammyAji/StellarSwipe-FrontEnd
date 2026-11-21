import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PortfolioAsset {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  /** Average cost per unit times quantity; undefined means data not available. */
  costBasis?: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  quotePrice?: number;
  quoteLastUpdated?: Date;
  /**
   * Wallet that holds this asset. Undefined means the holding's wallet is not
   * known — it must never be attributed to a wallet as fact.
   */
  walletAddress?: string;
}

export interface PortfolioState {
  assets: PortfolioAsset[];
  totalValue: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  isLoading: boolean;
  lastUpdated: Date | null;
  setAssets: (assets: PortfolioAsset[]) => void;
  setLoading: (loading: boolean) => void;
  updateAsset: (symbol: string, value: number) => void;
  removeAsset: (symbol: string) => void;
  clear: () => void;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      assets: [],
      totalValue: 0,
      totalRealizedPnL: 0,
      totalUnrealizedPnL: 0,
      isLoading: false,
      lastUpdated: null,
      setAssets: (assets) => {
        const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
        const totalRealizedPnL = assets.reduce(
          (sum, asset) => sum + (asset.realizedPnL ?? 0),
          0
        );
        const totalUnrealizedPnL = assets.reduce(
          (sum, asset) => sum + (asset.unrealizedPnL ?? 0),
          0
        );
        const normalizedAssets = assets.map((asset) => ({
          ...asset,
          percentage: totalValue > 0 ? (asset.value / totalValue) * 100 : 0,
        }));
        set({
          assets: normalizedAssets,
          totalValue,
          totalRealizedPnL,
          totalUnrealizedPnL,
          lastUpdated: new Date(),
        });
      },
      setLoading: (loading) => set({ isLoading: loading }),
      updateAsset: (symbol, value) => {
        const assets = get().assets.map((asset) =>
          asset.symbol === symbol ? { ...asset, value } : asset
        );
        const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
        const totalRealizedPnL = assets.reduce(
          (sum, asset) => sum + (asset.realizedPnL ?? 0),
          0
        );
        const totalUnrealizedPnL = assets.reduce(
          (sum, asset) => sum + (asset.unrealizedPnL ?? 0),
          0
        );
        const normalizedAssets = assets.map((asset) => ({
          ...asset,
          percentage: totalValue > 0 ? (asset.value / totalValue) * 100 : 0,
        }));
        set({
          assets: normalizedAssets,
          totalValue,
          totalRealizedPnL,
          totalUnrealizedPnL,
          lastUpdated: new Date(),
        });
      },
      removeAsset: (symbol) => {
        const assets = get().assets.filter((asset) => asset.symbol !== symbol);
        const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
        set({ assets, totalValue });
      },
      clear: () =>
        set({
          assets: [],
          totalValue: 0,
          totalRealizedPnL: 0,
          totalUnrealizedPnL: 0,
          lastUpdated: null,
        }),
    }),
    { name: "portfolio-store" }
  )
);
