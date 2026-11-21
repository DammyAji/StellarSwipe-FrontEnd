"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KeyboardShortcutsButton } from "@/components/KeyboardShortcutsButton";
import { KeyboardShortcutsHelpModal } from "@/components/KeyboardShortcutsHelpModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function NavHeader() {
  const pathname = usePathname();
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Register keyboard shortcut for "?" to toggle the help modal
  useKeyboardShortcuts([
    {
      key: "?",
      callback: () => setShowKeyboardHelp((open) => !open),
    },
  ]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-sticky border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground hover:text-accent-primary transition-colors"
          >
            StellarSwipe
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium transition-colors hover:text-accent-primary",
                pathname === "/" ? "text-accent-primary" : "text-foreground-muted"
              )}
            >
              Home
            </Link>
            <Link
              href="/app"
              className={cn(
                "text-sm font-medium transition-colors hover:text-accent-primary",
                pathname === "/app"
                  ? "text-accent-primary"
                  : "text-foreground-muted"
              )}
            >
              Signals
            </Link>
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <KeyboardShortcutsButton
                onClick={() => setShowKeyboardHelp(true)}
              />
            </div>
          </div>

          {/* Mobile menu toggle — 44px touch target */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile navigation panel */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-menu"
            className="border-t border-border px-4 pb-3 pt-2 md:hidden"
          >
            <div className="flex flex-col gap-1">
              <Link
                href="/"
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors hover:bg-foreground/10",
                  pathname === "/" ? "text-accent-primary" : "text-foreground-muted"
                )}
              >
                Home
              </Link>
              <Link
                href="/app"
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors hover:bg-foreground/10",
                  pathname === "/app" ? "text-accent-primary" : "text-foreground-muted"
                )}
              >
                Signals
              </Link>
              <div className="flex min-h-11 items-center px-3">
                <KeyboardShortcutsButton
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowKeyboardHelp(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </nav>

      <KeyboardShortcutsHelpModal
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </>
  );
}
