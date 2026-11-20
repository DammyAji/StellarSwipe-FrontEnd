"use client";

import Link from "next/link";
import { EMPTY_YEAR_MESSAGE } from "@/lib/taxYearData";

interface TaxYearDataNoticeProps {
  year: number;
  /** Number of transactions available for the selected year. */
  count: number;
}

/** Tells the user that a year has no transaction data, without implying there were no taxable events. */
export function TaxYearDataNotice({ year, count }: TaxYearDataNoticeProps) {
  if (count > 0) return null;
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
      data-testid="tax-year-empty-notice"
    >
      <p className="font-medium">No transaction data for {year}</p>
      <p className="mt-1 text-xs text-amber-200/80">{EMPTY_YEAR_MESSAGE}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <Link href="/journal" className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Import transactions
        </Link>
        <Link href="/journal" className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Review your journal records
        </Link>
      </div>
    </div>
  );
}
