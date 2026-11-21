/**
 * @jest-environment jsdom
 *
 * Component tests for SlippageControl (#1102) and its integration into
 * TradeConfirmationModal.
 *
 * Covers:
 * - Preset buttons render as a radiogroup with correct aria-checked states
 * - Clicking a preset calls onChange with the correct value
 * - Custom button reveals the input
 * - Valid custom value commits on blur and Enter
 * - Invalid custom value shows role="alert" and blocks confirmation
 * - Escape reverts custom mode
 * - Refreshing state disables all presets
 * - Min. received row updates live when slippage changes
 * - Confirm button disabled while slippage input is invalid
 * - TradeConfirmationModal: SlippageControl always present
 * - TradeConfirmationModal: minReceived reflects active slippage
 * - TradeConfirmationModal: Confirm disabled when slippage invalid
 * - TradeConfirmationModal: onSlippageChange called on preset selection
 */

import {
  render,
  screen,
  fireEvent,
  within,
  act,
} from "@testing-library/react";
import { SlippageControl } from "@/components/trade/SlippageControl";
import { TradeConfirmationModal } from "@/components/trade/TradeConfirmationModal";
import { useWalletStore } from "@/store/useWalletStore";

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

// ── SlippageControl ───────────────────────────────────────────────────────────

describe("SlippageControl", () => {
  const defaultPresets = [0.1, 0.5, 1, 3];

  it("renders preset buttons as a radiogroup", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    // All presets + Custom button
    expect(screen.getAllByRole("radio")).toHaveLength(defaultPresets.length + 1);
  });

  it("marks the active preset as checked", () => {
    render(<SlippageControl value={1} onChange={jest.fn()} />);
    const btn = screen.getByRole("radio", { name: "1%" });
    expect(btn).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "0.5%" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("calls onChange with the preset value on click", () => {
    const onChange = jest.fn();
    render(<SlippageControl value={0.5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "1%" }));
    expect(onChange).toHaveBeenCalledWith({
      value: 1,
      hasError: false,
      error: null,
    });
  });

  it("shows the Custom radio as unchecked initially", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("reveals the custom input when Custom is clicked", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(
      screen.getByRole("spinbutton", { name: "Custom slippage tolerance" })
    ).toBeInTheDocument();
  });

  it("marks Custom as checked when custom mode is active", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("commits a valid custom value on blur and calls onChange", () => {
    const onChange = jest.fn();
    render(<SlippageControl value={0.5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", {
      name: "Custom slippage tolerance",
    });
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith({
      value: 2,
      hasError: false,
      error: null,
    });
  });

  it("commits a valid custom value on Enter", () => {
    const onChange = jest.fn();
    render(<SlippageControl value={0.5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", {
      name: "Custom slippage tolerance",
    });
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith({
      value: 1.5,
      hasError: false,
      error: null,
    });
  });

  it("shows a role=alert for an invalid custom value on blur", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", {
      name: "Custom slippage tolerance",
    });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent(/maximum/i);
  });

  it("calls onChange with hasError:true for an invalid value", () => {
    const onChange = jest.fn();
    render(<SlippageControl value={0.5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", {
      name: "Custom slippage tolerance",
    });
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: null, hasError: true })
    );
  });

  it("sets aria-invalid on the input when value is invalid", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", {
      name: "Custom slippage tolerance",
    });
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("reverts to preset mode on Escape", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(
      screen.getByRole("spinbutton", { name: "Custom slippage tolerance" })
    ).toBeInTheDocument();
    fireEvent.keyDown(
      screen.getByRole("spinbutton", { name: "Custom slippage tolerance" }),
      { key: "Escape" }
    );
    expect(
      screen.queryByRole("spinbutton", { name: "Custom slippage tolerance" })
    ).not.toBeInTheDocument();
  });

  it("disables all preset buttons while refreshing", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} refreshing />);
    screen.getAllByRole("radio").forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("shows a 'Refreshing quote…' status while refreshing", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} refreshing />);
    expect(screen.getByRole("status")).toHaveTextContent(/refreshing quote/i);
  });

  it("renders a summary of the active tolerance when not in custom mode", () => {
    render(<SlippageControl value={0.5} onChange={jest.fn()} />);
    // The summary paragraph (not the preset button) should contain the value
    const summary = screen.getByText(/min\. received will be calculated at/i);
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent(/0\.5%/);
  });

  it("renders with a non-preset initial value and marks Custom as checked", () => {
    render(<SlippageControl value={2.5} onChange={jest.fn()} />);
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});

// ── TradeConfirmationModal integration ───────────────────────────────────────

describe("TradeConfirmationModal — slippage control (#1102)", () => {
  const baseDetails = {
    orderType: "market" as const,
    fromSymbol: "XLM",
    fromAmount: "100",
    toSymbol: "USDC",
    toAmount: "10",
    price: "0.1",
    minReceived: "9.95",
  };

  beforeEach(() => {
    useWalletStore.setState({ network: "TESTNET" });
  });

  it("renders the slippage control in the modal", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={baseDetails}
      />
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("defaults to 0.5% slippage preset selected", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={baseDetails}
      />
    );
    expect(screen.getByRole("radio", { name: "0.5%" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("uses slippageTolerance prop as initial value", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, slippageTolerance: 1 }}
      />
    );
    expect(screen.getByRole("radio", { name: "1%" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("calls onSlippageChange when user selects a different preset", () => {
    const onSlippageChange = jest.fn();
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, onSlippageChange }}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "1%" }));
    expect(onSlippageChange).toHaveBeenCalledWith(1);
  });

  it("recalculates minReceived live when slippage changes", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, slippageTolerance: 0.5 }}
      />
    );
    // Initial: 10 * (1 - 0.005) = 9.95
    expect(screen.getByText(/9\.95/)).toBeInTheDocument();

    // Switch to 1% slippage: 10 * (1 - 0.01) = 9.9
    fireEvent.click(screen.getByRole("radio", { name: "1%" }));
    expect(screen.getByText(/9\.9/)).toBeInTheDocument();
  });

  it("updates the Min. received hint to show the active slippage", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, slippageTolerance: 0.5 }}
      />
    );
    // Switch to 3%
    fireEvent.click(screen.getByRole("radio", { name: "3%" }));
    // The summary paragraph inside SlippageControl should reference 3%
    expect(
      screen.getByText(/min\. received will be calculated at/i)
    ).toHaveTextContent(/3%/);
  });

  it("disables Confirm button when custom slippage input is invalid", () => {
    const onConfirm = jest.fn();
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={baseDetails}
        onConfirm={onConfirm}
      />
    );
    // Enter custom mode and type an invalid value
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", {
      name: "Custom slippage tolerance",
    });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);

    const confirm = screen.getByRole("button", { name: /^confirm/i });
    expect(confirm).toBeDisabled();
  });

  it("re-enables Confirm button when a valid preset is selected after an invalid custom value", () => {
    const onConfirm = jest.fn();
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={baseDetails}
        onConfirm={onConfirm}
      />
    );
    // Enter invalid custom value
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", {
      name: "Custom slippage tolerance",
    });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);
    expect(screen.getByRole("button", { name: /^confirm/i })).toBeDisabled();

    // Select a preset — should re-enable
    fireEvent.click(screen.getByRole("radio", { name: "1%" }));
    expect(screen.getByRole("button", { name: /^confirm/i })).toBeEnabled();
  });

  it("shows slippageRefreshing status in the control", () => {
    render(
      <TradeConfirmationModal
        open
        onOpenChange={jest.fn()}
        details={{ ...baseDetails, slippageRefreshing: true }}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(/refreshing quote/i);
  });
});
