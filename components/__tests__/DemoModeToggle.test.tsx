import { render, screen, fireEvent } from "@testing-library/react";
import { DemoModeToggle } from "@/components/DemoModeToggle";
import { useDemoModeStore, useDemoModeHydrated } from "@/store/useDemoModeStore";

jest.mock("@/store/useDemoModeStore");

const mockUseDemoModeStore = useDemoModeStore as jest.MockedFunction<typeof useDemoModeStore>;
const mockUseDemoModeHydrated = useDemoModeHydrated as jest.MockedFunction<typeof useDemoModeHydrated>;

describe("DemoModeToggle", () => {
  beforeEach(() => {
    // Default: hydrated so the real button renders
    mockUseDemoModeHydrated.mockReturnValue(true);
  });

  it("renders a loading skeleton before hydration", () => {
    mockUseDemoModeHydrated.mockReturnValue(false);
    mockUseDemoModeStore.mockReturnValue({
      isDemoMode: false,
      _hasHydrated: false,
      setHasHydrated: jest.fn(),
      toggleDemoMode: jest.fn(),
      setDemoMode: jest.fn(),
    });

    render(<DemoModeToggle />);
    expect(screen.queryByText("Demo Mode")).toBeNull();
  });

  it("renders toggle button in off state", () => {
    mockUseDemoModeStore.mockReturnValue({
      isDemoMode: false,
      _hasHydrated: true,
      setHasHydrated: jest.fn(),
      toggleDemoMode: jest.fn(),
      setDemoMode: jest.fn(),
    });

    render(<DemoModeToggle />);
    expect(screen.getByText("Demo Mode")).toBeTruthy();
    expect(screen.queryByText("ON")).toBeNull();
  });

  it("renders toggle button in on state", () => {
    mockUseDemoModeStore.mockReturnValue({
      isDemoMode: true,
      _hasHydrated: true,
      setHasHydrated: jest.fn(),
      toggleDemoMode: jest.fn(),
      setDemoMode: jest.fn(),
    });

    render(<DemoModeToggle />);
    expect(screen.getByText("Demo Mode")).toBeTruthy();
    expect(screen.getByText("ON")).toBeTruthy();
  });

  it("calls toggle on click", () => {
    const mockToggle = jest.fn();
    mockUseDemoModeStore.mockReturnValue({
      isDemoMode: false,
      _hasHydrated: true,
      setHasHydrated: jest.fn(),
      toggleDemoMode: mockToggle,
      setDemoMode: jest.fn(),
    });

    render(<DemoModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /enter demo mode/i }));
    expect(mockToggle).toHaveBeenCalled();
  });
});
