/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

describe("Card", () => {
  it("renders a div with base card classes", () => {
    render(<Card data-testid="card">Body</Card>);
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveClass("rounded-xl");
    expect(card).toHaveClass("border-border");
    expect(card).toHaveTextContent("Body");
  });

  it("merges custom className", () => {
    render(<Card data-testid="card" className="mt-4" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("mt-4");
    expect(card).toHaveClass("bg-card");
  });

  it("forwards native attributes and refs", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref} data-testid="card" aria-label="summary" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(screen.getByTestId("card")).toHaveAttribute("aria-label", "summary");
  });

  it("renders CardHeader with layout classes and custom className", () => {
    render(<CardHeader data-testid="header" className="extra" />);
    const header = screen.getByTestId("header");
    expect(header).toHaveClass("flex");
    expect(header).toHaveClass("flex-col");
    expect(header).toHaveClass("extra");
  });

  it("renders CardContent with padding classes and children", () => {
    render(<CardContent data-testid="content">Confidence: 82%</CardContent>);
    const content = screen.getByTestId("content");
    expect(content).toHaveClass("px-5");
    expect(content).toHaveClass("pb-5");
    expect(content).toHaveTextContent("Confidence: 82%");
  });

  it("forwards refs for CardHeader and CardContent", () => {
    const headerRef = React.createRef<HTMLDivElement>();
    const contentRef = React.createRef<HTMLDivElement>();
    render(
      <>
        <CardHeader ref={headerRef} />
        <CardContent ref={contentRef} />
      </>
    );
    expect(headerRef.current).toBeInstanceOf(HTMLDivElement);
    expect(contentRef.current).toBeInstanceOf(HTMLDivElement);
  });

  it("composes a full card layout", () => {
    render(
      <Card>
        <CardHeader>
          <h3>Signal: XLM/USDC</h3>
        </CardHeader>
        <CardContent>
          <p>Confidence: 82%</p>
        </CardContent>
      </Card>
    );
    expect(screen.getByRole("heading", { name: "Signal: XLM/USDC" })).toBeInTheDocument();
    expect(screen.getByText("Confidence: 82%")).toBeInTheDocument();
  });
});
