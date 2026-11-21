/**
 * Pinned-signal feed ordering helpers (#1097).
 *
 * Pinned signals are hoisted to the top of the feed without changing global
 * sorting or breaking pagination: the rest of the feed keeps its existing
 * sort order, and signals that are pinned but not currently in the feed are
 * simply ignored (they re-pin themselves the next time they appear).
 *
 * All functions are pure with no side-effects, so the feed-ordering behaviour
 * is unit-testable without rendering the feed.
 */

export interface Identifiable {
  id: string;
}

/**
 * Reorders `signals` so that the pinned ids appear first, in pin order, then
 * every non-pinned signal in its existing order.
 *
 * Pinned ids that are not present in `signals` are skipped — they never create
 * a phantom row. Pin order is preserved (oldest pin first) so a long-pinned
 * signal stays above one pinned more recently.
 *
 * @example
 * const ordered = applyPins(
 *   [{ id: "b" }, { id: "a" }, { id: "c" }],
 *   ["a", "z"],   // z is pinned but not in the feed → ignored
 * );
 * // ordered = [{ id: "a" }, { id: "b" }, { id: "c" }]
 */
export function applyPins<T extends Identifiable>(
  signals: readonly T[],
  pinnedIds: readonly string[]
): T[] {
  if (!pinnedIds.length) return [...signals];

  // First occurrence of each id, for the pinned block.
  const byId = new Map<string, T>();
  for (const s of signals) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }

  // Pinned-first block: pinned ids that exist in the feed, in pin order.
  const pinnedSet = new Set(pinnedIds);
  const pinned: T[] = [];
  for (const id of pinnedIds) {
    const signal = byId.get(id);
    if (signal) pinned.push(signal);
  }

  // Non-pinned block: everything in its existing relative order, skipping only
  // the first occurrence of each pinned id (it was hoisted). Duplicates of a
  // pinned id stay where they are.
  const consumed = new Set<string>();
  const rest: T[] = [];
  for (const s of signals) {
    if (pinnedSet.has(s.id)) {
      if (!consumed.has(s.id)) {
        consumed.add(s.id);
        continue; // this one was hoisted
      }
      rest.push(s); // duplicate → stays
    } else {
      rest.push(s);
    }
  }

  return [...pinned, ...rest];
}

/**
 * Returns the index in `pinnedIds` for a signal id, or `-1` when not pinned.
 * Useful for stable row keys and "pinned position" labels.
 */
export function pinPosition(id: string, pinnedIds: readonly string[]): number {
  return pinnedIds.indexOf(id);
}

/**
 * True when at least one of the pinned ids is present in `signals`. Used by
 * the feed to decide whether to render a "Pinned" section divider.
 */
export function hasVisiblePins<T extends Identifiable>(
  signals: readonly T[],
  pinnedIds: readonly string[]
): boolean {
  if (!pinnedIds.length) return false;
  const present = new Set(signals.map((s) => s.id));
  return pinnedIds.some((id) => present.has(id));
}

/**
 * Stable key for a feed row: pinned rows are keyed with a `pin-` prefix so
 * React can tell them apart from their non-pinned neighbours even when ids
 * repeat across page boundaries. Non-pinned rows keep their id.
 */
export function feedRowKey(id: string, pinnedIds: readonly string[]): string {
  return pinnedIds.indexOf(id) >= 0 ? `pin-${id}` : id;
}
