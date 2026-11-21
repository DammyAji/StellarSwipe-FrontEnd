import { z } from "zod";

/**
 * Normalizes journal tags: trims, lowercases, collapses inner whitespace,
 * drops empty values and removes duplicates while keeping first-seen order.
 */
export function normalizeJournalTags(tags: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ").toLowerCase();
    if (tag) unique.add(tag);
  }
  return Array.from(unique);
}

/** Maximum number of reference links a single journal entry may carry. */
export const MAX_JOURNAL_LINKS = 10;
export const MAX_JOURNAL_LINK_LABEL_LENGTH = 80;
export const MAX_JOURNAL_LINK_URL_LENGTH = 2048;

/**
 * Only http(s) URLs are accepted as reference links. Anything else
 * (`javascript:`, `data:`, relative paths, …) is rejected so a stored link can
 * never become a script or an unexpected navigation target.
 */
export function isSafeJournalLinkUrl(value: string): boolean {
  const raw = value.trim();
  if (!raw || raw.length > MAX_JOURNAL_LINK_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/** A labeled external link attached to a journal entry. */
export interface JournalReferenceLink {
  label: string;
  url: string;
}

export const journalReferenceLinkSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Link label is required")
    .max(MAX_JOURNAL_LINK_LABEL_LENGTH, `Label must be ${MAX_JOURNAL_LINK_LABEL_LENGTH} characters or fewer`),
  url: z
    .string()
    .trim()
    .min(1, "Link URL is required")
    .refine(isSafeJournalLinkUrl, {
      message: "Enter a valid http:// or https:// URL",
    }),
});

/**
 * Normalizes reference links: trims label/URL, drops entries that are entirely
 * empty and removes duplicates (same URL, case-insensitive) keeping first-seen
 * order.
 */
export function normalizeJournalLinks(
  links: readonly Partial<JournalReferenceLink>[] | undefined
): JournalReferenceLink[] {
  const seen = new Set<string>();
  const out: JournalReferenceLink[] = [];
  for (const link of links ?? []) {
    const label = (link?.label ?? "").trim();
    const url = (link?.url ?? "").trim();
    if (!label && !url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, url });
  }
  return out;
}

/**
 * Zod schema for validating a single trade entry.
 * This is used for both manual entry and CSV bulk import.
 */
export const journalEntrySchema = z.object({
  date: z
    .string()
    .min(1, "Enter the trade date (YYYY-MM-DD).")
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Enter a valid date in YYYY-MM-DD format, e.g. 2024-05-31.",
    }),
  assetPair: z
    .string()
    .trim()
    .min(1, "Enter the asset pair you traded, e.g. XLM/USDC."),
  type: z.enum(["COPY_TRADE", "SWAP", "MANUAL"]),
  amount: z
    .string()
    .trim()
    .min(1, "Enter the amount you traded, e.g. 100.")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a number greater than 0, e.g. 100.",
    }),
  price: z
    .string()
    .trim()
    .min(1, "Enter the price per unit, e.g. 0.12.")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Price must be a number greater than 0, e.g. 0.12.",
    }),
  fee: z
    .string()
    .trim()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Fee must be 0 or a positive number, e.g. 0.01.",
    }),
  token: z
    .string()
    .trim()
    .min(1, "Enter the token symbol you traded, e.g. XLM."),
  status: z.enum(["PENDING", "SUCCEEDED", "FAILED"]),
  outcome: z.enum(["WIN", "LOSS", "PENDING"]),
  notes: z.string().optional(),
  tags: z.array(z.string()).transform(normalizeJournalTags).optional(),
  links: z
    .array(journalReferenceLinkSchema)
    .max(MAX_JOURNAL_LINKS, `Add at most ${MAX_JOURNAL_LINKS} links`)
    .transform(normalizeJournalLinks)
    .optional(),
});

export type JournalEntry = z.infer<typeof journalEntrySchema>;

/**
 * Expected CSV column names for mapping.
 */
export const CSV_COLUMNS = [
  "Date",
  "Asset Pair",
  "Type",
  "Amount",
  "Price",
  "Fee",
  "Token",
  "Status",
  "Outcome",
  "Notes",
] as const;

export type CSVColumn = (typeof CSV_COLUMNS)[number];
