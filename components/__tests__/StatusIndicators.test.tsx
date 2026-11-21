/** @jest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { SignalBadge } from "@/components/SignalBadge";
import { ProfitLossStatus } from "@/components/ProfitLossStatus";
import { OnChainConfirmationStatus } from "@/components/OnChainConfirmationStatus";

expect.extend(toHaveNoViolations);

describe("non-color status indicators", () => {
  it("distinguishes buy, sell, and neutral signals with text and shapes", () => {
    render(
      <div>
        <SignalBadge signal="BUY" />
        <SignalBadge signal="SELL" />
        <SignalBadge signal="NEUTRAL" />
      </div>
    );

    expect(screen.getByLabelText("BUY signal")).toHaveTextContent("BUY");
    expect(screen.getByLabelText("SELL signal")).toHaveTextContent("SELL");
    expect(screen.getByLabelText("NEUTRAL signal")).toHaveTextContent("NEUTRAL");
    expect(screen.getByLabelText("BUY signal").querySelector("svg")).toBeInTheDocument();
    expect(screen.getByLabelText("SELL signal").querySelector("svg")).toBeInTheDocument();
  });

  it.each([
    [10, "Profit"],
    [-10, "Loss"],
    [0, "Break-even"],
  ])("names the P&L state for value %s", (value, label) => {
    render(<ProfitLossStatus value={value} />);
    expect(screen.getByLabelText(label)).toHaveTextContent(label);
    expect(screen.getByLabelText(label).querySelector("svg")).toBeInTheDocument();
  });

  it("does not reveal the P&L direction while privacy mode is active", () => {
    render(<ProfitLossStatus value={-100} masked />);
    expect(screen.getByLabelText("Profit or loss hidden")).toHaveTextContent("Hidden");
    expect(screen.queryByText("Loss")).not.toBeInTheDocument();
  });

  it.each([
    ["PENDING", "Pending confirmation", "The transaction is waiting for on-chain confirmation."],
    ["SUCCEEDED", "On-chain confirmed", "The transaction was confirmed on Stellar."],
    ["FAILED", "Confirmation failed", "The transaction failed and was not confirmed."],
  ] as const)("shows %s with status text and distinct icon", (status, label, description) => {
    render(
      <OnChainConfirmationStatus
        status={status}
        transactionHash="example-hash"
      />
    );

    const statusRegion = screen.getByRole("status", { name: `Transaction status: ${label}` });
    expect(within(statusRegion).getByText(label)).toBeInTheDocument();
    expect(within(statusRegion).getByText(description)).toBeInTheDocument();
    expect(statusRegion.querySelector("svg")).toBeInTheDocument();
  });

  it("passes automated accessibility checks for representative signal, P&L, and transaction states", async () => {
    const { container } = render(
      <main>
        <h1>Status examples</h1>
        <div className="flex gap-2">
          <SignalBadge signal="BUY" />
          <SignalBadge signal="SELL" />
        </div>
        <ProfitLossStatus value={25} />
        <ProfitLossStatus value={-3} />
        <OnChainConfirmationStatus status="PENDING" transactionHash="pending-hash" />
        <OnChainConfirmationStatus status="FAILED" transactionHash="failed-hash" />
      </main>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
