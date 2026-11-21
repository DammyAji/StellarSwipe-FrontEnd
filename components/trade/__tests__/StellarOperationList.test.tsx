/**
 * @jest-environment jsdom
 *
 * Component tests for StellarOperationList (#1104) and its integration into
 * TradeConfirmationModal.
 *
 * Covers:
 * - Loading state (spinner + aria-busy)
 * - Empty state
 * - Error state (role="alert")
 * - Rendering known operations (payment, path payment, change trust)
 * - Rendering unknown / unsupported operations with a warning, never hiding them
 * - Mixed arrays with both known and unknown operations
 * - TradeConfirmationModal: section absent when no operations prop is provided
 * - TradeConfirmationModal: section present when operations prop is provided
 * - TradeConfirmationModal: loading + error states wired through
 */

import { render, screen, within } from "@testing-library/react";
import {
  StellarOperationList,
  type SdkOperation,
} from "@/components/trade/StellarOperationList";
import { TradeConfirmationModal } from "@/components/trade/TradeConfirmationModal";
import { useWalletStore } from "@/store/useWalletStore";

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const NATIVE_ASSET = { code: "XLM" };
const USDC_ASSET = { code: "USDC", issuer: ISSUER };

const paymentOp: SdkOperation = {
  type: "payment",
  destination: "GDEST",
  asset: USDC_ASSET,
  amount: "50.0000000",
};

const changeTrustOp: SdkOperation = {
  type: "changeTrust",
  line: USDC_ASSET,
  limit: "922337203685.4775807",
};

const pathPaymentOp: SdkOperation = {
  type: "pathPaymentStrictSend",
  sendAsset: NATIVE_ASSET,
  sendAmount: "100.0000000",
  destination: "GDEST",
  destAsset: USDC_ASSET,
  destMin: "9.5000000",
  path: [],
};

const unknownOp: SdkOperation = {
  type: "someFutureOp",
};

// ── StellarOperationList ─────────────────────────────────────────────────────

describe("StellarOperationList", () => {
  it("shows a spinner and aria-busy while loading", () => {
    render(<StellarOperationList loading />);
    const section = screen.getByRole("region", {
      name: /transaction operations/i,
    });
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("status", { name: /loading operations/i })
    ).toBeInTheDocument();
  });

  it("shows an empty-state message when operations is an empty array", () => {
    render(<StellarOperationList operations={[]} />);
    expect(
      screen.getByText(/no operations found/i)
    ).toBeInTheDocument();
  });

  it("shows an empty-state message when operations is null", () => {
    render(<StellarOperationList operations={null} />);
    expect(
      screen.getByText(/no operations found/i)
    ).toBeInTheDocument();
  });

  it("shows an error alert with the provided message", () => {
    render(
      <StellarOperationList error="Could not decode transaction" />
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/could not decode transaction/i);
  });

  it("shows a fallback error message when the error prop is a non-empty string", () => {
    render(
      <StellarOperationList error="Unable to decode transaction. Verify the transaction in your wallet before signing." />
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/verify the transaction in your wallet/i);
  });

  it("renders a payment operation with label, asset and amount", () => {
    render(<StellarOperationList operations={[paymentOp]} />);
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("50.0000000")).toBeInTheDocument();
    // Issuer address is shown so users can compare with their wallet.
    expect(screen.getByText(ISSUER)).toBeInTheDocument();
  });

  it("renders a changeTrust operation without an amount", () => {
    render(<StellarOperationList operations={[changeTrustOp]} />);
    expect(screen.getByText("Add trustline")).toBeInTheDocument();
    // No amount row should appear.
    expect(screen.queryByText(/amount/i)).not.toBeInTheDocument();
  });

  it("renders a pathPaymentStrictSend with send and receive assets", () => {
    render(<StellarOperationList operations={[pathPaymentOp]} />);
    expect(
      screen.getByText("Path payment (exact send)")
    ).toBeInTheDocument();
    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.getByText("100.0000000")).toBeInTheDocument();
    // destMin label
    expect(screen.getByText(/receive \(min\)/i)).toBeInTheDocument();
    expect(screen.getByText("9.5000000")).toBeInTheDocument();
  });

  it("surfaces an unknown operation with a warning, never hides it", () => {
    render(<StellarOperationList operations={[unknownOp]} />);
    expect(screen.getByText("Unknown operation")).toBeInTheDocument();
    // Type badge shows the raw type.
    expect(screen.getByText("someFutureOp")).toBeInTheDocument();
    // Warning note is present.
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/not recognised/i);
    expect(note).toHaveTextContent(/review it carefully/i);
  });

  it("renders all operations in a multi-operation array", () => {
    render(
      <StellarOperationList
        operations={[paymentOp, changeTrustOp, unknownOp]}
      />
    );
    const list = screen.getByRole("list", { name: /transaction operations/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("numbers operations correctly (1/N … N/N)", () => {
    render(
      <StellarOperationList
        operations={[paymentOp, changeTrustOp]}
      />
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("includes accessible labels for each operation", () => {
    render(<StellarOperationList operations={[paymentOp]} />);
    const item = screen.getByRole("listitem", {
      name: /operation 1 of 1, payment/i,
    });
    expect(item).toBeInTheDocument();
  });

  it("includes accessible label for an unknown operation", () => {
    render(<StellarOperationList operations={[unknownOp]} />);
    const item = screen.getByRole("listitem", {
      name: /unrecognised operation type/i,
    });
    expect(item).toBeInTheDocument();
  });
});

// ── TradeConfirmationModal integration ───────────────────────────────────────

describe("TradeConfirmationModal — Stellar operations section (#1104)", () => {
  const baseDetails = {
    orderType: "market" as const,
    fromSymbol: "XLM",
    fromAmount: "100",
    toSymbol: "USDC",
    toAmount: "10",
    price: "0.1",
    minReceived: "9.9",
  };

  beforeEach(() => {
    useWalletStore.setState({ network: "TESTNET" });
  });

  it("omits the operations section when no operations prop is provided", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={baseDetails}
      />
    );
    expect(
      screen.queryByRole("region", { name: /transaction operations/i })
    ).not.toBeInTheDocument();
  });

  it("shows the operations section when operations are provided", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, operations: [paymentOp, changeTrustOp] }}
      />
    );
    expect(
      screen.getByRole("region", { name: /transaction operations/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Add trustline")).toBeInTheDocument();
  });

  it("shows the loading state via operationsLoading prop", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, operationsLoading: true }}
      />
    );
    expect(
      screen.getByRole("status", { name: /loading operations/i })
    ).toBeInTheDocument();
  });

  it("shows the error state via operationsError prop", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{
          ...baseDetails,
          operationsError: "Failed to decode XDR",
        }}
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/failed to decode xdr/i);
  });

  it("keeps the Confirm button enabled even when an unknown operation is present", () => {
    const onConfirm = jest.fn();
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, operations: [unknownOp] }}
        onConfirm={onConfirm}
      />
    );
    const confirm = screen.getByRole("button", { name: /^confirm/i });
    expect(confirm).toBeEnabled();
  });

  it("surfaces unknown operations with a warning, not silently drops them", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, operations: [paymentOp, unknownOp] }}
      />
    );
    expect(screen.getByText("Unknown operation")).toBeInTheDocument();
    const notes = screen.getAllByRole("note");
    const opNote = notes.find((n) => /not recognised/i.test(n.textContent ?? ""));
    expect(opNote).toBeTruthy();
    expect(opNote).toHaveTextContent(/review it carefully/i);
  });
});
