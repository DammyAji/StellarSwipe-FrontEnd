/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  it("renders a native button with default variant and size classes", () => {
    render(<Button>Place Order</Button>);
    const btn = screen.getByRole("button", { name: "Place Order" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveClass("bg-primary");
    expect(btn).toHaveClass("h-9");
  });

  it.each([
    ["destructive", "bg-destructive"],
    ["outline", "border-input"],
    ["secondary", "bg-secondary"],
    ["ghost", "hover:bg-accent"],
    ["link", "underline-offset-4"],
  ] as const)("applies the %s variant classes", (variant, expected) => {
    render(<Button variant={variant}>Variant</Button>);
    expect(screen.getByRole("button")).toHaveClass(expected);
  });

  it.each([
    ["sm", "h-8"],
    ["lg", "h-10"],
    ["icon", "w-9"],
  ] as const)("applies the %s size classes", (size, expected) => {
    render(<Button size={size}>Sized</Button>);
    expect(screen.getByRole("button")).toHaveClass(expected);
  });

  it("merges custom className with variant classes", () => {
    render(<Button className="custom-class">Custom</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("custom-class");
    expect(btn).toHaveClass("bg-primary");
  });

  it("forwards native props and click handlers", () => {
    const onClick = jest.fn();
    render(
      <Button type="submit" disabled={false} onClick={onClick}>
        Submit
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("type", "submit");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards a ref to the underlying button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("renders the child element when asChild is set", () => {
    render(
      <Button asChild variant="link">
        <a href="/dashboard">Go to Dashboard</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Go to Dashboard" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(link).toHaveClass("underline-offset-4");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes buttonVariants for class composition", () => {
    expect(buttonVariants({ variant: "ghost", size: "sm" })).toContain("h-8");
    expect(buttonVariants()).toContain("bg-primary");
  });
});
