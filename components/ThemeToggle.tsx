"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeStore, useThemeHydrated } from "@/store/useThemeStore";
import { useEffect } from "react";

/**
 * Applies the active theme class to <html> and renders a toggle button.
 * Mount once (inside Navbar or layout) — it handles DOM sync automatically.
 *
 * Renders nothing until the persisted theme has been rehydrated from
 * localStorage to avoid a server/client mismatch.
 */
export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  const isHydrated = useThemeHydrated();

  // Sync theme class on <html> whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  }, [theme]);

  // Avoid rendering the wrong icon before hydration completes.
  // The layout's inline script already sets the correct class on <html>,
  // so suppressing this button until hydration is safe and flicker-free.
  if (!isHydrated) {
    return (
      <div
        className="h-8 w-8 rounded-md bg-surface-high/10 animate-pulse"
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-high/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 forced-colors:border forced-colors:border-[ButtonText] forced-colors:text-[ButtonText] forced-colors:focus-visible:ring-[Highlight]"
    >
      {theme === "dark" ? (
        <Sun size={16} aria-hidden="true" />
      ) : (
        <Moon size={16} aria-hidden="true" />
      )}
    </button>
  );
}
