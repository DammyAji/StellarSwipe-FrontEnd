import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_WIDGET_ORDER = [
  "portfolio-summary",
  "portfolio-allocation",
  "pnl-overview",
  "transaction-activity",
] as const;

export type DashboardWidgetId = (typeof DEFAULT_WIDGET_ORDER)[number];

/** A named, persisted widget arrangement. */
export interface SavedDashboardLayout {
  id: string;
  name: string;
  order: DashboardWidgetId[];
  visible: DashboardWidgetId[];
  createdAt: number;
}

interface DashboardLayoutState {
  order: DashboardWidgetId[];
  /** IDs currently visible (subset of order). Default: all visible. */
  visible: DashboardWidgetId[];
  /** Named layouts saved by the user. */
  savedLayouts: SavedDashboardLayout[];
  /** ID of the saved layout currently applied, if any. */
  activeLayoutId: string | null;
  /** Save the current arrangement under a name. Returns the layout ID. */
  saveLayout: (name: string) => string;
  /** Apply a saved layout. Unknown widget IDs are dropped. */
  applyLayout: (id: string) => void;
  /** Delete a saved layout. */
  deleteLayout: (id: string) => void;
  /** Restore the default arrangement (keeps saved layouts). */
  resetToDefault: () => void;
  moveBefore: (id: DashboardWidgetId) => void;
  moveAfter: (id: DashboardWidgetId) => void;
  moveToStart: (id: DashboardWidgetId) => void;
  moveToEnd: (id: DashboardWidgetId) => void;
  /** Add a widget at the end of the visible list (no-op if already added). */
  addWidget: (id: DashboardWidgetId) => void;
  /** Remove a widget from the visible list. */
  removeWidget: (id: DashboardWidgetId) => void;
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function isWidgetId(value: unknown): value is DashboardWidgetId {
  return DEFAULT_WIDGET_ORDER.includes(value as DashboardWidgetId);
}

/**
 * Sanitise a stored arrangement so it stays valid when widgets are removed or
 * unavailable: unknown IDs are dropped, duplicates removed, and any widget
 * missing from `order` is appended so it can still be re-added.
 */
export function sanitizeLayout(
  order: unknown,
  visible: unknown
): { order: DashboardWidgetId[]; visible: DashboardWidgetId[] } {
  const rawOrder = Array.isArray(order) ? order.filter(isWidgetId) : [];
  const safeOrder = Array.from(new Set(rawOrder));
  for (const id of DEFAULT_WIDGET_ORDER) {
    if (!safeOrder.includes(id)) safeOrder.push(id);
  }
  const rawVisible = Array.isArray(visible) ? visible.filter(isWidgetId) : [];
  const safeVisible = Array.from(new Set(rawVisible)).filter((id) =>
    safeOrder.includes(id)
  );
  return { order: safeOrder, visible: safeVisible };
}

function createLayoutId(): string {
  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      order: [...DEFAULT_WIDGET_ORDER],
      visible: [...DEFAULT_WIDGET_ORDER],
      savedLayouts: [],
      activeLayoutId: null,
      saveLayout: (name) => {
        const id = createLayoutId();
        set((state) => ({
          savedLayouts: [
            ...state.savedLayouts,
            {
              id,
              name: name.trim() || "Untitled layout",
              order: [...state.order],
              visible: [...state.visible],
              createdAt: Date.now(),
            },
          ],
          activeLayoutId: id,
        }));
        return id;
      },
      applyLayout: (id) =>
        set((state) => {
          const layout = state.savedLayouts.find((l) => l.id === id);
          if (!layout) return state;
          const { order, visible } = sanitizeLayout(layout.order, layout.visible);
          return { order, visible, activeLayoutId: id };
        }),
      deleteLayout: (id) =>
        set((state) => ({
          savedLayouts: state.savedLayouts.filter((l) => l.id !== id),
          activeLayoutId: state.activeLayoutId === id ? null : state.activeLayoutId,
        })),
      resetToDefault: () =>
        set({
          order: [...DEFAULT_WIDGET_ORDER],
          visible: [...DEFAULT_WIDGET_ORDER],
          activeLayoutId: null,
        }),
      moveBefore: (id) =>
        set((state) => {
          const i = state.order.indexOf(id);
          if (i <= 0) return state;
          return { order: swap(state.order, i, i - 1) };
        }),
      moveAfter: (id) =>
        set((state) => {
          const i = state.order.indexOf(id);
          if (i === -1 || i >= state.order.length - 1) return state;
          return { order: swap(state.order, i, i + 1) };
        }),
      moveToStart: (id) =>
        set((state) => {
          const i = state.order.indexOf(id);
          if (i <= 0) return state;
          const next = [...state.order];
          next.splice(i, 1);
          next.unshift(id);
          return { order: next };
        }),
      moveToEnd: (id) =>
        set((state) => {
          const i = state.order.indexOf(id);
          if (i === -1 || i === state.order.length - 1) return state;
          const next = [...state.order];
          next.splice(i, 1);
          next.push(id);
          return { order: next };
        }),
      addWidget: (id) =>
        set((state) => {
          if (state.visible.includes(id)) return state;
          // Append at end of visible list; also ensure it's in order.
          const newVisible = [...state.visible, id];
          const newOrder = state.order.includes(id)
            ? state.order
            : [...state.order, id];
          return { visible: newVisible, order: newOrder };
        }),
      removeWidget: (id) =>
        set((state) => ({
          visible: state.visible.filter((v) => v !== id),
        })),
    }),
    {
      name: "dashboard-layout-store",
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<DashboardLayoutState>;
        const { order, visible } = sanitizeLayout(state.order, state.visible);
        const savedLayouts: SavedDashboardLayout[] = Array.isArray(state.savedLayouts)
          ? state.savedLayouts.map((layout) => ({
              ...layout,
              ...sanitizeLayout(layout?.order, layout?.visible),
            }))
          : [];
        return {
          ...state,
          order,
          visible,
          savedLayouts,
          activeLayoutId: state.activeLayoutId ?? null,
        } as DashboardLayoutState;
      },
    }
  )
);
