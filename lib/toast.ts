import { DEFAULT_TOAST_DURATION, useToastStore } from "@/store/useToastStore";
import type { ToastAction, ToastTone } from "@/store/useToastStore";

export interface ToastOptions {
  description?: string;
  duration?: number;
  link?: { href: string; label: string };
  action?: ToastAction;
  countdownMs?: number;
}

function showToast(tone: ToastTone, title: string, options?: ToastOptions) {
  return useToastStore.getState().enqueue({
    tone,
    title,
    description: options?.description,
    link: options?.link,
    action: options?.action,
    duration: options?.duration ?? DEFAULT_TOAST_DURATION,
    countdownMs: options?.countdownMs,
  });
}

export const toast = {
  success: (title: string, options?: ToastOptions) =>
    showToast("success", title, options),
  error: (title: string, options?: ToastOptions) =>
    showToast("error", title, options),
  info: (title: string, options?: ToastOptions) =>
    showToast("info", title, options),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

export function useToast() {
  const enqueue = useToastStore((state) => state.enqueue);
  const dismiss = useToastStore((state) => state.dismiss);

  return {
    success: (title: string, options?: ToastOptions) =>
      enqueue({
        tone: "success",
        title,
        description: options?.description,
        link: options?.link,
        action: options?.action,
        duration: options?.duration ?? DEFAULT_TOAST_DURATION,
      }),
    error: (title: string, options?: ToastOptions) =>
      enqueue({
        tone: "error",
        title,
        description: options?.description,
        link: options?.link,
        action: options?.action,
        duration: options?.duration ?? DEFAULT_TOAST_DURATION,
      }),
    info: (title: string, options?: ToastOptions) =>
      enqueue({
        tone: "info",
        title,
        description: options?.description,
        link: options?.link,
        action: options?.action,
        duration: options?.duration ?? DEFAULT_TOAST_DURATION,
      }),
    dismiss,
  };
}
