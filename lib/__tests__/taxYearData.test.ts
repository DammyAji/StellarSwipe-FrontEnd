import { summarizeYearData, yearOptionLabel } from "@/lib/taxYearData";

const at = (year: number, month = 5) => ({ timestamp: new Date(year, month, 15).getTime() });

describe("summarizeYearData", () => {
  it("counts transactions per requested year and flags empty years", () => {
    const result = summarizeYearData([at(2024), at(2024, 1), at(2022)], [2025, 2024, 2023, 2022]);
    expect(result).toEqual([
      { year: 2025, count: 0, hasData: false },
      { year: 2024, count: 2, hasData: true },
      { year: 2023, count: 0, hasData: false },
      { year: 2022, count: 1, hasData: true },
    ]);
  });

  it("treats no transactions at all as every year empty", () => {
    expect(summarizeYearData([], [2024, 2025]).every((y) => !y.hasData)).toBe(true);
  });
});

describe("yearOptionLabel", () => {
  it("shows the count for years with data and marks empty years", () => {
    expect(yearOptionLabel({ year: 2024, count: 1, hasData: true })).toBe("2024 (1 transaction)");
    expect(yearOptionLabel({ year: 2024, count: 3, hasData: true })).toBe("2024 (3 transactions)");
    expect(yearOptionLabel({ year: 2023, count: 0, hasData: false })).toBe("2023 (no data)");
  });
});
