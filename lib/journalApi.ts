/**
 * journalApi.ts
 *
 * Simulated backend API for journal entries.
 *
 * In production this module talks to a real backend; for now it stores data
 * in an in-memory Map and introduces an artificial delay to demonstrate the
 * optimistic-update pattern.
 *
 * Using an explicit API layer keeps the store and components testable — swap
 * the implementation behind the same exported interface when a real endpoint
 * is ready.
 */

import type { TransactionHistoryItem, TransactionStatus, TransactionOutcome } from "@/store/useTransactionStore";

// ---------------------------------------------------------------------------
// In-memory store (simulates a database / remote API)
// ---------------------------------------------------------------------------

const entries = new Map<string, TransactionHistoryItem>();

/** Seed with the initial data the store already has. */
export function seedJournalEntries(initial: TransactionHistoryItem[]): void {
  for (const entry of initial) {
    entries.set(entry.id, entry);
  }
}

// ---------------------------------------------------------------------------
// Simulated network latency
// ---------------------------------------------------------------------------

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export class JournalApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "JournalApiError";
  }
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Create a new journal entry on the "server".
 * Returns the created entry with a server-generated id (simulated).
 */
export async function createJournalEntry(
  entry: Omit<TransactionHistoryItem, "id">
): Promise<TransactionHistoryItem> {
  await delay(350);

  // Simulate a rare server error (5% chance) to exercise rollback paths
  if (Math.random() < 0.05) {
    throw new JournalApiError(
      "Server temporarily unavailable. Your entry has been saved locally and will sync when the connection is restored.",
      "SERVER_BUSY"
    );
  }

  const id = `tx-srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const created: TransactionHistoryItem = { ...entry, id, revision: 1 };
  entries.set(id, created);
  return created;
}

/**
 * Update an existing journal entry.
 *
 * When `expectedRevision` is given, the update is rejected with a CONFLICT
 * error if the server copy has moved on since that revision, so a newer
 * version is never overwritten silently.
 */
export async function updateJournalEntry(
  id: string,
  patch: Partial<TransactionHistoryItem>,
  expectedRevision?: number
): Promise<TransactionHistoryItem> {
  await delay(300);

  const existing = entries.get(id);
  if (!existing) {
    throw new JournalApiError("Journal entry not found.", "NOT_FOUND");
  }

  if (expectedRevision !== undefined && existing.revision !== expectedRevision) {
    throw new JournalApiError(
      "This entry was changed elsewhere. Your edits are kept here — overwrite the newer version or cancel.",
      "CONFLICT"
    );
  }

  if (Math.random() < 0.03) {
    throw new JournalApiError(
      "Failed to save changes. Your update has been preserved locally.",
      "SAVE_FAILED"
    );
  }

  const updated: TransactionHistoryItem = {
    ...existing,
    ...patch,
    revision: (existing.revision ?? 0) + 1,
  };
  entries.set(id, updated);
  return updated;
}

/**
 * Delete a journal entry.
 */
export async function deleteJournalEntry(
  id: string
): Promise<{ deleted: true }> {
  await delay(250);

  if (!entries.has(id)) {
    throw new JournalApiError("Journal entry not found.", "NOT_FOUND");
  }

  if (Math.random() < 0.03) {
    throw new JournalApiError(
      "Failed to delete entry. Please try again.",
      "DELETE_FAILED"
    );
  }

  entries.delete(id);
  return { deleted: true };
}

/**
 * Fetch the current server copy of a single entry.
 *
 * Used by the editor to detect that the stored data changed after it opened
 * (e.g. the entry was edited in another tab) before saving over it.
 */
export async function fetchJournalEntry(
  id: string
): Promise<TransactionHistoryItem> {
  await delay(150);

  const existing = entries.get(id);
  if (!existing) {
    throw new JournalApiError("Journal entry not found.", "NOT_FOUND");
  }

  return { ...existing };
}

/**
 * Fetch all journal entries (for hydration from server).
 */
export async function fetchJournalEntries(): Promise<TransactionHistoryItem[]> {
  await delay(300);
  return Array.from(entries.values()).sort((a, b) => b.timestamp - a.timestamp);
}
