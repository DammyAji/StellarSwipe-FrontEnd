/** Adds the run to the favorites, or removes it when it is already one. Never mutates the input. */
export function toggleFavorite(favoriteIds: readonly string[], runId: string): string[] {
  return favoriteIds.includes(runId) ? favoriteIds.filter((id) => id !== runId) : [...favoriteIds, runId];
}

/** Drops favorites whose runs no longer exist (for example after the history was cleared). */
export function pruneFavorites(favoriteIds: readonly string[], existingRunIds: readonly string[]): string[] {
  const existing = new Set(existingRunIds);
  const kept = favoriteIds.filter((id) => existing.has(id));
  return kept.length === favoriteIds.length ? (favoriteIds as string[]) : kept;
}

/** Runs to show: all of them, or only favorites. The run objects themselves are never changed. */
export function filterRunsByFavorite<T extends { id: string }>(
  runs: readonly T[],
  favoriteIds: readonly string[],
  favoritesOnly: boolean
): T[] {
  if (!favoritesOnly) return [...runs];
  const favorites = new Set(favoriteIds);
  return runs.filter((run) => favorites.has(run.id));
}

/** Text announced after toggling a favorite. */
export function favoriteAnnouncement(isNowFavorite: boolean, saved: boolean): string {
  const base = isNowFavorite ? "Added to favorites" : "Removed from favorites";
  return saved ? `${base}. Saved on this device.` : `${base}, but it could not be saved on this device and will be lost on reload.`;
}
