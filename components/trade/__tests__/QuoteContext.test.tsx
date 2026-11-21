import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuoteContext } from "@/components/trade/QuoteContext";

describe("QuoteContext", () => {
  it("labels missing metadata as unavailable in the empty state", () => {
    const markup = renderToStaticMarkup(React.createElement(QuoteContext));

    expect(markup).toContain("No quote metadata is available for this preview.");
    expect(markup.match(/Unavailable/g)).toHaveLength(2);
  });

  it("shows source and a browser-localized received time when metadata is available", () => {
    const receivedAt = "2024-01-02T03:04:00.000Z";
    const localizedTime = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(receivedAt));

    const markup = renderToStaticMarkup(
      React.createElement(QuoteContext, {
        context: { status: "ready", source: "Stellar Horizon", receivedAt },
      })
    );

    expect(markup).toContain("Stellar Horizon");
    expect(markup).toContain(localizedTime);
  });

  it("does not invent missing or invalid metadata", () => {
    const markup = renderToStaticMarkup(
      React.createElement(QuoteContext, {
        context: { status: "ready", source: "  ", receivedAt: "not-a-date" },
      })
    );

    expect(markup.match(/Unavailable/g)).toHaveLength(2);
  });

  it("announces loading and withholds metadata until it is ready", () => {
    const markup = renderToStaticMarkup(
      React.createElement(QuoteContext, {
        context: { status: "loading", source: "Stale source", receivedAt: "2024-01-02" },
      })
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Loading quote context");
    expect(markup).not.toContain("Stale source");
    expect(markup).toContain('aria-busy="true"');
  });

  it("announces errors without displaying stale metadata as current", () => {
    const markup = renderToStaticMarkup(
      React.createElement(QuoteContext, {
        context: { status: "error", source: "Stale source", receivedAt: "2024-01-02" },
      })
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Quote context could not be loaded");
    expect(markup).not.toContain("Stale source");
  });
});
