"use client";

import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  link?: { href: string; label: string };
  action?: ToastAction;
  tone: ToastTone;
  duration: number;
  /** Optional visible countdown (ms) shown next to the action, e.g. "Undo · 8s". */
  countdownMs?: number;
}

interface ToastState {
  toasts: ToastMessage[];
  enqueue: (toast: Omit<ToastMessage, "id">) => string;
  dismiss: (id: string) => void;
  /** Pause auto-dismiss while a toast is hovered or focused. */
  pause: (id: string) => void;
  /** Resume auto-dismiss with the remaining time once hover/focus ends. */
  resume: (id: string) => void;
}

// Auto-dismiss timers live outside React state so pause/resume is cheap.
const timers = new Map<
  string,
  { handle?: number; remaining: number; startedAt: number }
>();

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer?.handle !== undefined) window.clearTimeout(timer.handle);
  timers.delete(id);
}

export const DEFAULT_TOAST_DURATION = 5000;

// Caps the visible stack so toasts always lay out vertically without
// overrunning the viewport; oldest toast is evicted once the cap is hit.
export const MAX_VISIBLE_TOASTS = 4;

function generateToastId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  enqueue: ({
    title,
    description,
    link,
    action,
    tone,
    duration = DEFAULT_TOAST_DURATION,
    countdownMs,
  }) => {
    const id = generateToastId();
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, title, description, link, action, tone, duration, countdownMs },
      ].slice(-MAX_VISIBLE_TOASTS),
    }));

    if (typeof window !== "undefined" && duration > 0) {
      timers.set(id, {
        handle: window.setTimeout(() => get().dismiss(id), duration),
        remaining: duration,
        startedAt: Date.now(),
      });
    }

    return id;
  },
  dismiss: (id) => {
    if (typeof window !== "undefined") clearTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  pause: (id) => {
    const timer = timers.get(id);
    if (!timer || timer.handle === undefined) return;
    window.clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  },
  resume: (id) => {
    const timer = timers.get(id);
    if (!timer || timer.handle !== undefined) return;
    timer.startedAt = Date.now();
    timer.handle = window.setTimeout(() => get().dismiss(id), timer.remaining);
  },
}));
