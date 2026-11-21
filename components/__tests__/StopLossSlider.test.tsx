/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { StopLossSlider } from "@/components/ui/stop-loss-slider";

describe("StopLossSlider", () => {
  it("renders the label, value and min/max labels", () => {
    render(<StopLossSlider value={10} onChange={jest.fn()} />);
    expect(screen.getByText("Stop-Loss")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("associates the label with the range input", () => {
    render(<StopLossSlider value={10} onChange={jest.fn()} />);
    const input = screen.getByLabelText("Stop-Loss");
    expect(input).toHaveAttribute("type", "range");
    expect(input).toHaveAttribute("aria-label", "Stop-loss percentage");
  });

  it("calls onChange with the numeric value while dragging", () => {
    const onChange = jest.fn();
    render(<StopLossSlider value={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("clamps values above max and below min", () => {
    const onChange = jest.fn();
    render(<StopLossSlider value={10} onChange={onChange} min={5} max={50} />);
    const input = screen.getByRole("slider");
    fireEvent.change(input, { target: { value: "80" } });
    expect(onChange).toHaveBeenLastCalledWith(50);
    fireEvent.change(input, { target: { value: "1" } });
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it("clamps the displayed value and aria attributes", () => {
    render(<StopLossSlider value={150} onChange={jest.fn()} />);
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("aria-valuenow", "100");
    expect(input).toHaveAttribute("aria-valuemax", "100");
    expect(input).toHaveAttribute("aria-valuemin", "0");
    expect(input).toHaveAttribute("aria-valuetext", "100% stop-loss");
  });

  it("derives the stop-loss price from the entry price", () => {
    render(
      <StopLossSlider value={10} onChange={jest.fn()} entryPrice={0.4821} assetSymbol="XLM" />
    );
    expect(screen.getByText("≈ 0.4339 XLM")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "10% stop-loss, price 0.4339 XLM"
    );
  });

  it("uses the default asset symbol when none is provided", () => {
    render(<StopLossSlider value={20} onChange={jest.fn()} entryPrice={1} />);
    expect(screen.getByText("≈ 0.8000 XLM")).toBeInTheDocument();
  });

  it("omits the price when entryPrice is not provided", () => {
    render(<StopLossSlider value={20} onChange={jest.fn()} />);
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });

  it.each([
    [5, "text-accent-success"],
    [20, "text-accent-warning"],
    [50, "text-accent-danger"],
  ])("applies the risk colour for value %i", (value, expected) => {
    render(<StopLossSlider value={value} onChange={jest.fn()} />);
    expect(screen.getByText(`${value}%`)).toHaveClass(expected);
  });

  it("fills the active track proportionally", () => {
    const { container } = render(
      <StopLossSlider value={25} onChange={jest.fn()} min={0} max={50} />
    );
    const fill = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(fill.style.width).toBe("50%");
  });

  it("respects custom min, max and step", () => {
    render(
      <StopLossSlider value={5} onChange={jest.fn()} min={1} max={25} step={0.5} />
    );
    const input = screen.getByRole("slider");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "25");
    expect(input).toHaveAttribute("step", "0.5");
  });

  it("disables the input and applies disabled styles", () => {
    const { container } = render(
      <StopLossSlider value={10} onChange={jest.fn()} disabled />
    );
    const input = screen.getByRole("slider");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("cursor-not-allowed");
    expect(container.firstChild).toHaveClass("flex");
  });

  it("merges a custom className on the wrapper", () => {
    const { container } = render(
      <StopLossSlider value={10} onChange={jest.fn()} className="mt-6" />
    );
    expect(container.firstChild).toHaveClass("mt-6");
  });
});
