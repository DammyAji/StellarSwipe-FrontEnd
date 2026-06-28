import { render, screen, fireEvent } from "@testing-library/react";
import { KeyboardShortcutsHelpModal } from "@/components/KeyboardShortcutsHelpModal";

describe("KeyboardShortcutsHelpModal", () => {
  it("renders the keyboard shortcuts list", () => {
    render(<KeyboardShortcutsHelpModal open={true} onClose={jest.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Arrow Up / Arrow Down")).toBeInTheDocument();
    expect(screen.getByText("Arrow Right / Enter / Space")).toBeInTheDocument();
    expect(screen.getByText("Escape")).toBeInTheDocument();
  });

  it("closes when Escape is pressed inside the dialog", () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsHelpModal open={true} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsHelpModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("keyboard-shortcuts-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
