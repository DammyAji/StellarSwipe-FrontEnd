"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  LogOut,
  Pencil,
  PlusCircle,
  RefreshCw,
  UserCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/useClipboard";
import { NICKNAME_MAX_LENGTH, normalizeNickname } from "@/store/useWalletStore";

function truncate(key: string) {
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function WalletDropdown() {
  const {
    publicKey,
    wallets,
    activePublicKey,
    defaultTradeWalletPublicKey,
    switchWallet,
    setDefaultTradeWallet,
    setWalletNickname,
    connectAnother,
    disconnect,
    disconnectAll,
    isConnecting,
  } = useWallet();
  const router = useRouter();
  const { refetch } = usePortfolio();
  const [open, setOpen] = useState(false);
  const { copied, status: copyStatus, errorMessage: copyError, copy, reset: resetCopy } = useClipboard({ resetDelay: 2000 });
  const isCopyError = copyStatus === "error";
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  // Account switcher state
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // Nickname editor state — one wallet at a time.
  const [editingNicknameFor, setEditingNicknameFor] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const truncated = publicKey ? truncate(publicKey) : "";
  const activeNickname =
    wallets.find((w) => w.publicKey === activePublicKey)?.nickname ?? null;

  function startEditingNickname(key: string, current?: string) {
    setEditingNicknameFor(key);
    setNicknameDraft(current ?? "");
    setNicknameError(null);
    requestAnimationFrame(() => nicknameInputRef.current?.focus());
  }

  function cancelEditingNickname() {
    setEditingNicknameFor(null);
    setNicknameDraft("");
    setNicknameError(null);
  }

  function saveNickname(key: string) {
    const normalized = normalizeNickname(nicknameDraft);
    if (nicknameDraft.trim().length > 0 && !normalized) {
      setNicknameError("Enter a nickname or clear the field to remove it.");
      return;
    }
    try {
      setWalletNickname(key, nicknameDraft);
      cancelEditingNickname();
    } catch {
      setNicknameError("Could not save nickname. Please try again.");
    }
  }

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    await copy(publicKey);
  }, [publicKey, copy]);

  function handleClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshed(false);
    try {
      await refetch();
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 2500);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  /**
   * Switch to a different wallet account.
   * Shows a loading state while switching and rolls back (preserving current
   * context) on failure, so a failed switch never leaves the user stranded.
   */
  const handleSwitchWallet = useCallback(
    async (key: string) => {
      if (switchingTo) return;
      setSwitchingTo(key);
      setSwitchError(null);
      try {
        switchWallet(key);
        // Refresh route data after switch so navigation context is consistent.
        router.refresh();
        await refetch();
      } catch {
        // Keep current wallet active — preserve context until switch succeeds.
        setSwitchError("Failed to switch account. Your current account is still active.");
        setTimeout(() => setSwitchError(null), 4000);
      } finally {
        setSwitchingTo(null);
      }
    },
    [switchingTo, switchWallet, router, refetch]
  );

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const menu = menuRef.current;
        if (!menu) return;
        const items = Array.from(
          menu.querySelectorAll<HTMLElement>('[role="menuitem"]')
        );
        if (!items.length) return;
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === "ArrowDown"
            ? idx < 0
              ? 0
              : (idx + 1) % items.length
            : idx < 0
            ? items.length - 1
            : (idx - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        ref={triggerRef}
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          switchingTo
            ? "Switching wallet account…"
            : publicKey
            ? `Wallet menu for ${activeNickname ? `${activeNickname}, ` : ""}${truncated}`
            : "Wallet menu"
        }
        className="font-mono gap-2"
      >
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              switchingTo ? "bg-yellow-400" : "bg-green-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              switchingTo ? "bg-yellow-500" : "bg-green-500"
            )}
          />
        </span>
        <span className="max-w-[9rem] truncate sm:max-w-none">{truncated}</span>
        {activeNickname && (
          <span className="max-w-[7rem] truncate font-sans text-xs text-muted-foreground">
            {activeNickname}
          </span>
        )}
        {switchingTo && (
          <span className="hidden text-[10px] font-sans text-yellow-600 dark:text-yellow-300 sm:inline">
            Switching…
          </span>
        )}
        {wallets.length > 1 && (
          <span className="rounded-full bg-blue-500/20 px-1.5 text-[10px] text-blue-400 font-semibold">
            {wallets.length}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </Button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Wallet options"
          className="absolute end-0 mt-2 max-h-[min(80vh,36rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border bg-popover p-2 shadow-lg flex flex-col gap-1 z-50"
        >
          {/* Connected wallets list */}
          {wallets.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {wallets.length > 1 ? "Switch account" : "Current account"}
              </p>
              {/* Switch error — preserves context while showing feedback */}
              {switchError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-2 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-[11px] text-yellow-700 dark:text-yellow-300"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{switchError}</span>
                </div>
              )}
              <ul className="flex flex-col gap-1" role="list" aria-label="Wallet accounts">
                {wallets.map((w) => {
                  const isActive = w.publicKey === activePublicKey;
                  const isSwitchingToThis = switchingTo === w.publicKey;
                  return (
                    <li key={w.publicKey}>
                      <button
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => {
                          if (!isActive && !switchingTo) handleSwitchWallet(w.publicKey);
                        }}
                        aria-label={
                          isActive
                            ? `Current account: ${truncate(w.publicKey)}`
                            : isSwitchingToThis
                            ? `Switching to ${truncate(w.publicKey)}…`
                            : `Switch to account: ${truncate(w.publicKey)}`
                        }
                        aria-pressed={isActive}
                        aria-busy={isSwitchingToThis}
                        disabled={!!switchingTo && !isSwitchingToThis}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isActive
                            ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            : isSwitchingToThis
                            ? "bg-accent text-foreground cursor-wait"
                            : "hover:bg-accent text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <UserCircle2
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              isActive ? "text-blue-400" : "text-muted-foreground"
                            )}
                            aria-hidden="true"
                          />
                          {truncate(w.publicKey)}
                          {isActive && (
                            <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400 not-sr-only">
                              active
                            </span>
                          )}
                        </span>
                        {isSwitchingToThis ? (
                          <Loader2
                            className="h-3 w-3 animate-spin text-blue-400"
                            aria-hidden="true"
                          />
                        ) : isActive ? (
                          <Check
                            className="h-3 w-3 text-blue-400"
                            aria-label="Active"
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Preselect for new trades
                </p>
                <div role="group" aria-label="Default account for new trades">
                  {wallets.map((wallet) => {
                    const isDefault =
                      defaultTradeWalletPublicKey === wallet.publicKey;
                    return (
                      <button
                        key={`trade-default-${wallet.publicKey}`}
                        type="button"
                        role="menuitem"
                        tabIndex={0}
                        onClick={() =>
                          setDefaultTradeWallet(wallet.publicKey)
                        }
                        aria-label={`Set ${wallet.nickname ?? truncate(wallet.publicKey)} as default for new trades`}
                        aria-pressed={isDefault}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 truncate">
                          {wallet.nickname
                            ? `${wallet.nickname} · ${truncate(wallet.publicKey)}`
                            : truncate(wallet.publicKey)}
                        </span>
                        {isDefault && (
                          <Check
                            className="h-3 w-3 shrink-0 text-blue-400"
                            aria-label="Default for new trades"
                          />
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => setDefaultTradeWallet(null)}
                    aria-label="Ask me to choose an account for each trade"
                    aria-pressed={defaultTradeWalletPublicKey === null}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Ask me to choose each time
                  </button>
                </div>
                {defaultTradeWalletPublicKey &&
                  !wallets.some(
                    (wallet) =>
                      wallet.publicKey === defaultTradeWalletPublicKey,
                  ) && (
                    <p role="status" className="mt-1 px-3 text-[11px] text-amber-600 dark:text-amber-300">
                      Saved default is not connected. New trades will ask you
                      to choose an account.
                    </p>
                  )}
              </div>
            </div>
          )}

          <hr className="border-border" />

          {/* Add another wallet */}
          <button
            role="menuitem"
            tabIndex={0}
            onClick={() => {
              handleClose();
              connectAnother();
            }}
            disabled={isConnecting}
            aria-label="Connect another wallet"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:opacity-60"
          >
            <PlusCircle className="h-4 w-4 text-blue-400" aria-hidden="true" />
            Connect another wallet
          </button>

          <hr className="border-border" />

          {/* Full active address */}
          <p className="px-3 py-2 text-xs font-mono text-muted-foreground break-all select-all">
            {publicKey}
          </p>

          {/* Refresh balance */}
          <button
            role="menuitem"
            tabIndex={0}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={
              isRefreshing
                ? "Refreshing wallet balance…"
                : refreshed
                ? "Balance refreshed"
                : "Refresh wallet balance"
            }
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshed ? (
              <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
            ) : (
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isRefreshing && "animate-spin text-blue-400"
                )}
                aria-hidden="true"
              />
            )}
            <span aria-live="polite">
              {isRefreshing
                ? "Refreshing…"
                : refreshed
                ? "Balance updated"
                : "Refresh balance"}
            </span>
          </button>

          {/* Copy */}
          <button
            role="menuitem"
            tabIndex={0}
            onClick={isCopyError ? resetCopy : handleCopy}
            aria-label={
              copied
                ? "Address copied"
                : isCopyError
                ? "Copy failed — click to dismiss"
                : "Copy wallet address"
            }
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-4 w-4 text-green-600" />
            ) : isCopyError ? (
              <AlertTriangle aria-hidden="true" className="h-4 w-4 text-yellow-500" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
            {copied ? "Copied!" : isCopyError ? "Retry" : "Copy address"}
          </button>

          {/* Accessible status announcement for screen readers */}
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Wallet address copied to clipboard" : ""}
          </span>

          {/* Manual-copy fallback — only shown when clipboard API fails */}
          {isCopyError && copyError && (
            <div
              role="alert"
              className="mx-2 flex flex-col gap-1.5 rounded border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-[11px] leading-snug text-yellow-700 dark:text-yellow-300"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{copyError}</span>
                <button
                  type="button"
                  aria-label="Dismiss copy error"
                  onClick={resetCopy}
                  className="shrink-0 rounded p-0.5 hover:bg-yellow-500/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-yellow-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {publicKey && (
                <input
                  type="text"
                  readOnly
                  value={publicKey}
                  aria-label="Wallet address to copy manually"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full select-all rounded border border-yellow-500/30 bg-background px-1.5 py-1 font-mono text-[11px] text-foreground"
                />
              )}
            </div>
          )}

          <hr className="border-border" />

          {/* Disconnect active */}
          <button
            role="menuitem"
            tabIndex={0}
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            aria-label="Disconnect active wallet"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Disconnect
          </button>

          {/* Disconnect all */}
          {wallets.length > 1 && (
            <button
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                disconnectAll();
                setOpen(false);
              }}
              aria-label="Disconnect all wallets"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive/80 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Disconnect all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
