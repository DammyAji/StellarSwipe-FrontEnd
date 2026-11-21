import type { JournalEntry } from "@/lib/journalSchema";

/**
 * Reusable starter templates for journal entries (#1061).
 *
 * A template only ever pre-fills the editor: applying one never saves an
 * entry and never touches an existing one. Fields a template leaves out
 * (amount, price, fee, asset pair, token) stay empty for the user to fill in.
 */
export interface JournalTemplate {
  id: string;
  name: string;
  description: string;
  /** Fields copied into the editor when the template is applied. */
  fields: Partial<JournalEntry>;
}

export const JOURNAL_TEMPLATES: readonly JournalTemplate[] = [
  {
    id: "spot-swap",
    name: "Spot swap",
    description: "A completed swap on the Stellar DEX.",
    fields: {
      type: "SWAP",
      status: "SUCCEEDED",
      outcome: "PENDING",
      notes: "Entry thesis:\nExit plan:\nWhat I would do differently:",
      tags: ["swap"],
    },
  },
  {
    id: "copy-trade",
    name: "Copy trade",
    description: "A trade mirrored from a followed provider.",
    fields: {
      type: "COPY_TRADE",
      status: "SUCCEEDED",
      outcome: "PENDING",
      notes: "Provider:\nReason for following:\nDeviation from provider:",
      tags: ["copy-trade"],
    },
  },
  {
    id: "manual-review",
    name: "Manual review",
    description: "Backfill a trade you executed elsewhere.",
    fields: {
      type: "MANUAL",
      status: "SUCCEEDED",
      outcome: "PENDING",
      notes: "Why I took this trade:\nResult:\nLesson learned:",
      tags: ["review"],
    },
  },
  {
    id: "failed-order",
    name: "Failed order",
    description: "Record an order that did not go through.",
    fields: {
      type: "MANUAL",
      status: "FAILED",
      outcome: "LOSS",
      notes: "What failed:\nSlippage / fees paid:\nFollow-up:",
      tags: ["failed-order"],
    },
  },
];

export function getJournalTemplate(id: string): JournalTemplate | undefined {
  return JOURNAL_TEMPLATES.find((template) => template.id === id);
}

/**
 * Builds the form values for a template. The date is always today's date so
 * a template never reuses a stale timestamp, and tags are merged with any
 * tags already in the editor rather than replacing them.
 */
export function applyJournalTemplate(
  template: JournalTemplate,
  current: Partial<JournalEntry> = {},
  today: string = new Date().toISOString().split("T")[0]
): Partial<JournalEntry> {
  const { tags: templateTags, ...rest } = template.fields;
  return {
    ...current,
    ...rest,
    date: today,
    tags: Array.from(new Set([...(current.tags ?? []), ...(templateTags ?? [])])),
  };
}
