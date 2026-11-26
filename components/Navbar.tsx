"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Zap } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { WalletDropdown } from "@/components/WalletDropdown";
import { WalletSelectionModal } from "@/components/WalletSelectionModal";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcutsHelpModal } from "@/components/KeyboardShortcutsHelpModal";
import { useKeyboardShortcuts, type ShortcutConfig } from "@/hooks/useKeyboardShortcuts";
import { useFocusReturn } from "@/hooks/useFocusReturn";
import { useThemeStore } from "@/store/useThemeStore";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/app", label: "Signals", tourId: "signals" },
  { href: "/journal", label: "Journal" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/compare", label: "Compare", tourId: "compare" },
  { href: "/providers", label: "Providers" },
  { href: "/tax-report", label: "Tax Report" },
  { href: "/preferences", label: "Preferences" },
];

const routeShortcuts: Record<string, string> = {
  n: "/app",
  b: "/bookmarks",
  h: "/",
  j: "/journal",
  p: "/providers",
  t: "/tax-report",
  c: "/compare",
  s: "/backtest-sim",
};

// ---------------------------------------------------------------------------
// Overflow menu — items that don't fit in the nav bar (#557)
// ---------------------------------------------------------------------------
interface OverflowMenuProps {
  links: typeof NAV_LINKS;
  currentPath: string;
}

function OverflowMenu({ links, currentPath }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const hasActive = links.some((l) => l.href === currentPath);

  return (
    <li className="relative" data-testid="nav-overflow-item">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More navigation items"
        data-testid="nav-overflow-trigger"
        className={cn(
          "flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          hasActive
            ? "bg-surface-high/60 font-medium text-foreground"
            : "text-foreground-muted hover:text-foreground hover:bg-surface-high/40"
        )}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
        <span className="sr-only">More</span>
        {hasActive && (
          <span
            className="ml-0.5 h-1.5 w-1.5 rounded-full bg-blue-400"
            aria-hidden="true"
            title="Current route is in this menu"
          />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Additional navigation items"
          data-testid="nav-overflow-menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-background/95 py-1 shadow-lg backdrop-blur-md"
        >
          {links.map(({ href, label, tourId }) => {
            const isActive = href === currentPath;
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                data-tour={tourId}
                data-testid={`overflow-link-${href.replace(/\//g, "-")}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center justify-between px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:bg-surface-high/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary",
                  isActive
                    ? "bg-surface-high/60 font-medium text-foreground"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface-high/40"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
                {isActive && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-blue-400"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Responsive nav list — splits links into visible + overflow based on width
// ---------------------------------------------------------------------------

/**
 * Number of nav links to show inline before collapsing the rest into the
 * overflow menu.  We use a ResizeObserver on the <nav> element to recalculate
 * this dynamically, but keep a static fallback so SSR renders correctly.
 *
 * Breakpoint logic (approximate link widths ~90px each):
 *  < 600 px  → show 0 links  (mobile — full list hidden, covered by a future mobile drawer)
 *  < 600 px  → show 3 links + overflow menu
 *  600–800   → show 3 links
 *  800–1024  → show 5 links
 *  ≥ 1024    → show all links
 */
function useVisibleLinkCount(navRef: React.RefObject<HTMLElement | null>): number {
  const [count, setCount] = useState(NAV_LINKS.length);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    function update(width: number) {
      if (width < 600) setCount(3);
      else if (width < 800) setCount(3);
      else if (width < 1024) setCount(5);
      else setCount(NAV_LINKS.length);
    }

    const ro = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width);
    });
    ro.observe(el);
    update(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [navRef]);

  return count;
}

// ---------------------------------------------------------------------------
// Wallet connect control — connect button / truncated key + disconnect (#1174)
// ---------------------------------------------------------------------------
function truncatePublicKey(key: string): string {
  if (key.length <= 10) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

interface WalletConnectControlProps {
  connected: boolean;
  isConnecting: boolean;
  publicKey?: string | null;
  onConnectClick: () => void;
  onDisconnect: () => void;
}

function WalletConnectControl({
  connected,
  isConnecting,
  publicKey,
  onConnectClick,
  onDisconnect,
}: WalletConnectControlProps) {
  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-2" data-testid="wallet-connected">
        <span
          className="rounded-md border border-border bg-surface-high/40 px-2.5 py-1.5 font-mono text-xs text-foreground"
          title={publicKey}
          data-testid="wallet-public-key"
        >
          {truncatePublicKey(publicKey)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          data-testid="wallet-disconnect"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={onConnectClick}
      disabled={isConnecting}
      data-testid="wallet-connect"
    >
      {isConnecting ? (
        <>
          <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden="true" />
          Connecting…
        </>
      ) : (
        "Connect Wallet"
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { connected, isConnecting, connect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Open command palette on Cmd+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleCount = useVisibleLinkCount(navRef);
  const visibleLinks = useMemo(
    () => NAV_LINKS.slice(0, visibleCount),
    [visibleCount]
  );
  const overflowLinks = useMemo(
    () => NAV_LINKS.slice(visibleCount),
    [visibleCount]
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Zap size={18} className="text-accent-primary" aria-hidden="true" />
          StellarSwipe
        </Link>

        <nav ref={navRef} className="hidden flex-1 items-center justify-center md:flex">
          <ul className="flex items-center gap-1">
            {visibleLinks.map(({ href, label, tourId }) => {
              const isActive = href === pathname;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    data-tour={tourId}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-surface-high/60 font-medium text-foreground"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface-high/40"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            {overflowLinks.length > 0 && (
              <OverflowMenu links={overflowLinks} currentPath={pathname} />
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
          <WalletConnectControl
            connected={connected}
            isConnecting={isConnecting}
            publicKey={(useWallet() as { publicKey?: string | null }).publicKey}
            onConnectClick={() => setWalletModalOpen(true)}
            onDisconnect={() => {
              const w = useWallet() as { disconnect?: () => void };
              w.disconnect?.();
            }}
          />
          <WalletDropdown />
        </div>
      </div>

      <WalletSelectionModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={connect}
      />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsHelpModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
    </header>
  );
}
