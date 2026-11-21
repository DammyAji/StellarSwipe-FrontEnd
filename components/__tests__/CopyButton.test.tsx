/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CopyButton } from "@/components/ui/copy-button";

const mockCopy = jest.fn();
const mockReset = jest.fn();
let mockState = {
  copied: false,
  status: "idle" as "idle" | "copied" | "error",
  errorMessage: null as string | null,
};

jest.mock("@/hooks/useClipboard", () => ({
  useClipboard: () => ({
    ...mockState,
    copy: mockCopy,
    reset: mockReset,
  }),
}));

describe("CopyButton", () => {
  beforeEach(() => {
    mockCopy.mockReset();
    mockReset.mockReset();
    mockState = { copied: false, status: "idle", errorMessage: null };
  });

  it("renders the default label and copy icon", () => {
    render(<CopyButton value="abc" />);
    const btn = screen.getByRole("button", { name: "Copy" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveAttribute("title", "Copy");
    expect(btn).toHaveTextContent("Copy");
  });

  it("uses a custom label for aria-label and title", () => {
    render(<CopyButton value="abc" label="Copy address" />);
    const btn = screen.getByRole("button", { name: "Copy address" });
    expect(btn).toHaveAttribute("title", "Copy address");
  });

  it("calls copy with the value on click", () => {
    render(<CopyButton value="secret-value" label="Copy key" />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockCopy).toHaveBeenCalledWith("secret-value");
  });

  it("merges custom className and forwards native props", () => {
    render(
      <CopyButton value="abc" className="border-0" data-testid="copy" disabled />
    );
    const btn = screen.getByTestId("copy");
    expect(btn).toHaveClass("border-0");
    expect(btn).toBeDisabled();
  });

  it("forwards a ref to the button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<CopyButton value="abc" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("shows the copied state", () => {
    mockState = { copied: true, status: "copied", errorMessage: null };
    render(<CopyButton value="abc" label="Copy" />);
    const btn = screen.getByRole("button", { name: "Copied!" });
    expect(btn).toHaveAttribute("title", "Copied!");
    expect(btn).toHaveTextContent("Copied!");
    expect(btn).toHaveClass("text-accent-success");
  });

  it("shows the error state with a recovery hint and resets on click", () => {
    mockState = {
      copied: false,
      status: "error",
      errorMessage: "Please copy manually.",
    };
    render(<CopyButton value="abc" label="Copy" />);
    const btn = screen.getByRole("button", {
      name: "Copy — failed, see recovery hint",
    });
    expect(btn).toHaveAttribute("title", "Copy failed");
    expect(btn).toHaveTextContent("Retry");
    expect(screen.getByRole("alert")).toHaveTextContent("Please copy manually.");

    fireEvent.click(btn);
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("hides the recovery hint when no error message is present", () => {
    mockState = { copied: false, status: "error", errorMessage: null };
    render(<CopyButton value="abc" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("passes resetDelay through to the clipboard hook", () => {
    const spy = jest.spyOn(
      jest.requireMock("@/hooks/useClipboard"),
      "useClipboard"
    );
    render(<CopyButton value="abc" resetDelay={5000} />);
    expect(spy).toHaveBeenCalledWith({ resetDelay: 5000 });
    spy.mockRestore();
  });

  it("re-renders when the clipboard state changes", () => {
    const { rerender } = render(<CopyButton value="abc" />);
    expect(screen.getByRole("button")).toHaveTextContent("Copy");
    act(() => {
      mockState = { copied: true, status: "copied", errorMessage: null };
    });
    rerender(<CopyButton value="abc" />);
    expect(screen.getByRole("button")).toHaveTextContent("Copied!");
  });
});
