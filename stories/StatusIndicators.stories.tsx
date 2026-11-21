import type { Meta, StoryObj } from "@storybook/react";
import { SignalBadge } from "@/components/SignalBadge";
import { ProfitLossStatus } from "@/components/ProfitLossStatus";
import { OnChainConfirmationStatus } from "@/components/OnChainConfirmationStatus";

const meta: Meta = {
  title: "Accessibility/Non-color status indicators",
  parameters: {
    chromatic: { viewports: [375, 768, 1280] },
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj;

export const BuySellAndNeutral: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-background p-6 text-foreground">
      <SignalBadge signal="BUY" />
      <SignalBadge signal="SELL" />
      <SignalBadge signal="NEUTRAL" />
    </div>
  ),
};

export const ProfitLossAndBreakEven: Story = {
  render: () => (
    <div className="grid max-w-md gap-3 rounded-xl bg-background p-6 text-foreground sm:grid-cols-3">
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm">Positive return</p>
        <ProfitLossStatus value={42.5} />
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm">Negative return</p>
        <ProfitLossStatus value={-12.25} />
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm">No change</p>
        <ProfitLossStatus value={0} />
      </div>
    </div>
  ),
};

export const TransactionConfirmationStates: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-3 rounded-xl bg-background p-6 text-foreground">
      <OnChainConfirmationStatus status="PENDING" transactionHash="pending-hash" />
      <OnChainConfirmationStatus status="SUCCEEDED" transactionHash="success-hash" />
      <OnChainConfirmationStatus status="FAILED" transactionHash="failed-hash" />
    </div>
  ),
};
