import type { Meta, StoryObj } from "@storybook/react";
import { TradeConfirmationModal } from "@/components/trade/TradeConfirmationModal";

const meta: Meta<typeof TradeConfirmationModal> = {
  title: "Trade/TradeConfirmationModal",
  component: TradeConfirmationModal,
  tags: ["autodocs"],
  parameters: {
    // Chromatic: capture full viewport including the overlay
    chromatic: { viewports: [375, 768] },
    layout: "fullscreen",
  },
  args: {
    open: true,
    onOpenChange: () => {},
    isSubmitting: false,
  },
};

export default meta;
type Story = StoryObj<typeof TradeConfirmationModal>;

// ── Market order ─────────────────────────────────────────────────────────────

export const MarketOrderLight: Story = {
  name: "Market Order – Light",
  parameters: { themes: { themeOverride: "light" } },
  args: {
    details: {
      orderType: "market",
      fromSymbol: "XLM",
      fromAmount: "500",
      toSymbol: "USDC",
      toAmount: "47.00",
      price: "1 XLM = 0.094 USDC",
      minReceived: "46.77",
      priceImpact: "< 0.01%",
      networkFee: "~0.00001 XLM",
      platformFee: "0.1% ($0.0470)",
    },
  },
};

export const MarketOrderDark: Story = {
  name: "Market Order – Dark",
  parameters: { themes: { themeOverride: "dark" } },
  args: {
    details: {
      orderType: "market",
      fromSymbol: "XLM",
      fromAmount: "500",
      toSymbol: "USDC",
      toAmount: "47.00",
      price: "1 XLM = 0.094 USDC",
      minReceived: "46.77",
      priceImpact: "< 0.01%",
      networkFee: "~0.00001 XLM",
      platformFee: "0.1% ($0.0470)",
    },
  },
};

// ── Limit order ──────────────────────────────────────────────────────────────

export const LimitOrderLight: Story = {
  name: "Limit Order – Light",
  parameters: { themes: { themeOverride: "light" } },
  args: {
    details: {
      orderType: "limit",
      fromSymbol: "XLM",
      fromAmount: "1000",
      toSymbol: "USDC",
      toAmount: "100.00",
      price: "1 XLM = 0.10 USDC",
      minReceived: "99.50",
      priceImpact: "< 0.01%",
      networkFee: "~0.00001 XLM",
      platformFee: "0.1% ($0.1000)",
      expiry: "24 hours",
    },
  },
};

export const LimitOrderDark: Story = {
  name: "Limit Order – Dark",
  parameters: { themes: { themeOverride: "dark" } },
  args: {
    details: {
      orderType: "limit",
      fromSymbol: "XLM",
      fromAmount: "1000",
      toSymbol: "USDC",
      toAmount: "100.00",
      price: "1 XLM = 0.10 USDC",
      minReceived: "99.50",
      priceImpact: "< 0.01%",
      networkFee: "~0.00001 XLM",
      platformFee: "0.1% ($0.1000)",
      expiry: "24 hours",
    },
  },
};

// ── Submitting states ─────────────────────────────────────────────────────────

export const MarketOrderSubmittingLight: Story = {
  name: "Market Order Submitting – Light",
  parameters: { themes: { themeOverride: "light" } },
  args: {
    isSubmitting: true,
    details: {
      orderType: "market",
      fromSymbol: "XLM",
      fromAmount: "500",
      toSymbol: "USDC",
      toAmount: "47.00",
      price: "1 XLM = 0.094 USDC",
      minReceived: "46.77",
      platformFee: "0.1% ($0.0470)",
    },
  },
};

export const MarketOrderSubmittingDark: Story = {
  name: "Market Order Submitting – Dark",
  parameters: { themes: { themeOverride: "dark" } },
  args: {
    isSubmitting: true,
    details: {
      orderType: "market",
      fromSymbol: "XLM",
      fromAmount: "500",
      toSymbol: "USDC",
      toAmount: "47.00",
      price: "1 XLM = 0.094 USDC",
      minReceived: "46.77",
      platformFee: "0.1% ($0.0470)",
    },
  },
};

// ── Deliberate visual regression — fee row misaligned ────────────────────────
// This story intentionally introduces a layout change to confirm Chromatic
// catches the diff. Approve the baseline, then this diff validates the tooling.

export const VisualRegressionFeeAlignment: Story = {
  name: "[Visual Regression] Fee Row Misaligned",
  parameters: {
    themes: { themeOverride: "light" },
    chromatic: {
      // Do NOT auto-accept this story as baseline — it is meant to show a diff
      disableSnapshot: false,
    },
  },
  args: {
    details: {
      orderType: "market",
      fromSymbol: "XLM",
      fromAmount: "500",
      toSymbol: "USDC",
      toAmount: "47.00",
      price: "1 XLM = 0.094 USDC",
      minReceived: "46.77",
      platformFee: "0.1% ($0.0470)",
      _visualRegressionTest: true,
    },
  },
};
