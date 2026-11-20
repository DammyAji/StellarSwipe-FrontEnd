import { resolveCategory, TAX_CATEGORIES, TAX_CATEGORY_LABELS, type CategoryAssignments, type TaxCategory } from "@/lib/taxCategorization";
import type { TaxEntry, TaxableTransaction } from "@/lib/taxUtils";

export type SummaryCategory = TaxCategory | "uncategorized";

export interface CategoryGroup {
  category: SummaryCategory;
  label: string;
  count: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  fees: number;
  /** The report lines that make up the group. */
  lines: TaxEntry[];
}

export interface CategorySummary {
  groups: CategoryGroup[];
  totals: { count: number; proceeds: number; costBasis: number; gainLoss: number; fees: number };
  /** Whether the groups add up to the report (count and gain/loss). */
  reconciles: boolean;
  /** Difference between the groups' gain/loss and the report total; 0 when it reconciles. */
  gainLossDifference: number;
}

export const UNCATEGORIZED_LABEL = "Uncategorized or unresolved";

const EPSILON = 1e-6;

/**
 * Groups report lines by tax category. Lines whose category is unsupported,
 * unknown or left unresolved stay visible in their own group, so every line (and
 * therefore every total) of the report is counted exactly once.
 */
export function summarizeByCategory(
  entries: readonly TaxEntry[],
  transactionsById: ReadonlyMap<string, TaxableTransaction>,
  assignments: CategoryAssignments,
  reportTotalGainLoss?: number
): CategorySummary {
  const groups = new Map<SummaryCategory, CategoryGroup>();
  const order: SummaryCategory[] = [...TAX_CATEGORIES, "uncategorized"];
  for (const entry of entries) {
    const tx = transactionsById.get(entry.id);
    const category: SummaryCategory = (tx ? resolveCategory(tx, assignments) : null) ?? "uncategorized";
    const group =
      groups.get(category) ??
      ({
        category,
        label: category === "uncategorized" ? UNCATEGORIZED_LABEL : TAX_CATEGORY_LABELS[category],
        count: 0,
        proceeds: 0,
        costBasis: 0,
        gainLoss: 0,
        fees: 0,
        lines: [],
      } as CategoryGroup);
    group.count += 1;
    group.proceeds += entry.proceeds;
    group.costBasis += entry.costBasis;
    group.gainLoss += entry.gainLoss;
    group.fees += entry.fees;
    group.lines.push(entry);
    groups.set(category, group);
  }
  const ordered = order.flatMap((c) => (groups.has(c) ? [groups.get(c)!] : []));
  const totals = ordered.reduce(
    (t, g) => ({
      count: t.count + g.count,
      proceeds: t.proceeds + g.proceeds,
      costBasis: t.costBasis + g.costBasis,
      gainLoss: t.gainLoss + g.gainLoss,
      fees: t.fees + g.fees,
    }),
    { count: 0, proceeds: 0, costBasis: 0, gainLoss: 0, fees: 0 }
  );
  const expected = reportTotalGainLoss ?? entries.reduce((s, e) => s + e.gainLoss, 0);
  const gainLossDifference = totals.gainLoss - expected;
  const reconciles = totals.count === entries.length && Math.abs(gainLossDifference) <= EPSILON;
  return { groups: ordered, totals, reconciles, gainLossDifference: reconciles ? 0 : gainLossDifference };
}
