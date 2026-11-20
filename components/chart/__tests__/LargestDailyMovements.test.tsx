/** @jest-environment jsdom */

import { render, screen, fireEvent } from "@testing-library/react";
import { LargestDailyMovements } from "@/components/chart/LargestDailyMovements";
import type { PortfolioValuePoint } from "@/lib/benchmark";

describe("LargestDailyMovements", () => {
  const day1 = new Date("2025-01-01T12:00:00Z").getTime();
  const day2 = new Date("2025-01-02T12:00:00Z").getTime();
  const day3 = new Date("2025-01-03T12:00:00Z").getTime();

  const portfolioHistory: PortfolioValuePoint[] = [
    { timestamp: day1, value: 1000 },
    { timestamp: day2, value: 1200 }, // +200 (largest gain)
    { timestamp: day3, value: 1050 }, // -150 (largest loss)
  ];

  const chartPortfolioPts = [
    { timestamp: day1, value: 1000, x: 0, y: 100 },
    { timestamp: day2, value: 1200, x: 50, y: 50 },
    { timestamp: day3, value: 1050, x: 100, y: 80 },
  ];

  it("renders loading state when portfolioHistory is empty", () => {
    render(
      <LargestDailyMovements
        portfolioHistory={[]}
        chartPortfolioPts={[]}
        chartWidth={300}
        chartHeight={160}
      />
    );
    expect(screen.getByText("Loading movements…")).toBeInTheDocument();
  });

  it("renders insufficient history state when history has fewer than 2 points", () => {
    render(
      <LargestDailyMovements
        portfolioHistory={[{ timestamp: day1, value: 1000 }]}
        chartPortfolioPts={[]}
        chartWidth={300}
        chartHeight={160}
      />
    );
    expect(screen.getByText("Insufficient history")).toBeInTheDocument();
  });

  it("renders largest gain and largest loss correctly and handles clicks", () => {
    const onSelectMovement = jest.fn();

    render(
      <LargestDailyMovements
        portfolioHistory={portfolioHistory}
        chartPortfolioPts={chartPortfolioPts}
        chartWidth={300}
        chartHeight={160}
        onSelectMovement={onSelectMovement}
      />
    );

    expect(screen.getByText("Largest Daily Movements")).toBeInTheDocument();
    expect(screen.getByText("Largest Gain")).toBeInTheDocument();
    expect(screen.getByText("Largest Loss")).toBeInTheDocument();

    // Click largest gain
    const gainButton = screen.getByLabelText(/Largest gain:/);
    fireEvent.click(gainButton);
    expect(onSelectMovement).toHaveBeenCalledWith(
      expect.objectContaining({ change: 200 }),
      1 // index of day2 in chartPortfolioPts
    );

    // Click largest loss
    const lossButton = screen.getByLabelText(/Largest loss:/);
    fireEvent.click(lossButton);
    expect(onSelectMovement).toHaveBeenCalledWith(
      expect.objectContaining({ change: -150 }),
      2 // index of day3 in chartPortfolioPts
    );
  });
});
