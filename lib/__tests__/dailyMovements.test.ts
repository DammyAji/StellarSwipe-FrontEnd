import {
  calculateDailyMovements,
  findLargestDailyMovements,
  hasSufficientHistoryForDailyMovements,
  type DailyMovement,
} from "@/lib/dailyMovements";
import type { PortfolioValuePoint } from "@/lib/benchmark";

describe("dailyMovements", () => {
  const day1 = new Date("2025-01-01T12:00:00Z").getTime();
  const day2 = new Date("2025-01-02T12:00:00Z").getTime();
  const day3 = new Date("2025-01-03T12:00:00Z").getTime();
  const day4 = new Date("2025-01-04T12:00:00Z").getTime();

  it("returns empty array for insufficient history (< 2 points)", () => {
    const history: PortfolioValuePoint[] = [{ timestamp: day1, value: 1000 }];
    expect(calculateDailyMovements(history)).toEqual([]);
    expect(hasSufficientHistoryForDailyMovements(history)).toBe(false);
  });

  it("calculates daily movements correctly between consecutive days", () => {
    const history: PortfolioValuePoint[] = [
      { timestamp: day1, value: 1000 },
      { timestamp: day2, value: 1100 }, // +100 (10%)
      { timestamp: day3, value: 990 },  // -110 (-10%)
      { timestamp: day4, value: 1200 }, // +210 (~21.21%)
    ];

    const movements = calculateDailyMovements(history);
    expect(movements.length).toBe(3);
    expect(movements[0].change).toBe(100);
    expect(movements[0].changePercent).toBe(10);
    expect(movements[1].change).toBe(-110);
    expect(movements[2].change).toBe(210);
    expect(hasSufficientHistoryForDailyMovements(history)).toBe(true);
  });

  it("does not rank missing days as zero (only uses recorded days)", () => {
    // If day 2 is missing, we only have day 1 and day 3
    const history: PortfolioValuePoint[] = [
      { timestamp: day1, value: 1000 },
      { timestamp: day3, value: 1500 }, // +500 between day 1 and day 3
    ];

    const movements = calculateDailyMovements(history);
    expect(movements.length).toBe(1);
    expect(movements[0].change).toBe(500);
    // Missing day 2 is not interpolated or ranked as zero movement.
  });

  it("finds largest daily gain and largest daily loss correctly", () => {
    const movements: DailyMovement[] = [
      { day: day2, value: 1100, change: 100, changePercent: 10 },
      { day: day3, value: 1000, change: -100, changePercent: -9.09 },
      { day: day4, value: 1300, change: 300, changePercent: 30 }, // Largest gain
    ];

    const { largestGain, largestLoss } = findLargestDailyMovements(movements);
    expect(largestGain?.day).toBe(day4);
    expect(largestGain?.change).toBe(300);
    expect(largestLoss?.day).toBe(day3);
    expect(largestLoss?.change).toBe(-100);
  });

  it("handles all gains or all losses gracefully", () => {
    const movements: DailyMovement[] = [
      { day: day2, value: 1100, change: 100, changePercent: 10 },
      { day: day3, value: 1250, change: 150, changePercent: 13.64 },
    ];

    const { largestGain, largestLoss } = findLargestDailyMovements(movements);
    expect(largestGain?.change).toBe(150);
    expect(largestLoss).toBeNull();
  });
});
