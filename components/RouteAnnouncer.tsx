"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useFocusAfterNavigation } from "@/hooks/useFocusAfterNavigation";

/**
 * RouteAnnouncer
 * ──────────────
 * Announces completed client-side route transitions to screen reader users,
 * who can't rely on the visual page transition to know navigation happened.
 *
 * - Tracks the resolved pathname directly (rather than the page-transition
 *   store, which is only completed by pages that opt in), so every client-side
 *   navigation — including browser back/forward — is announced.
 * - Announces once per pathname (a ref guards against duplicate announcements
 *   from re-renders, and rapid A→B→C navigation only ever announces the final
 *   destination C).
 * - Uses document.title, which pages set via metadata/generateMetadata, as
 *   the human-readable destination name.
 *
 * Focus management (#790)
 * ────────────────────────
 * Also moves keyboard focus to the new page's heading (or #main-content)
 * after each navigation via useFocusAfterNavigation, so keyboard and
 * screen-reader users are not left stranded on the previous page's DOM.
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  // Skip announcing the very first render (initial page load) — a screen
  // reader already announces the document title on load.
  const announcedPath = useRef<string | null>(pathname);

  // Restore focus to the new page's heading after each navigation (#790).
  useFocusAfterNavigation();

  useEffect(() => {
    if (announcedPath.current === pathname) return;
    announcedPath.current = pathname;

    // Give document.title (set by the newly-rendered route) a tick to
    // update before reading it.
    const id = requestAnimationFrame(() => {
      setMessage(`Navigated to ${document.title || "page"}`);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  );
}
