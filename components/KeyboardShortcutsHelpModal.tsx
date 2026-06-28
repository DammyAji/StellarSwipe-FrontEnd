"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface KeyboardShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    key: "?",
    description: "Open this keyboard shortcuts overlay.",
  },
  {
    key: "Arrow Up / Arrow Down",
    description: "Move focus between signals in the feed.",
  },
  {
    key: "Arrow Right / Enter / Space",
    description: "Open the trade modal for the focused signal.",
  },
  {
    key: "Arrow Left",
    description: "Pass on the focused signal.",
  },
  {
    key: "Escape",
    description: "Close this overlay or any open modal.",
  },
  {
    key: "Enter",
    description: "Confirm the trade inside the open trade modal when focus is not on a form control.",
  },
];

export function KeyboardShortcutsHelpModal({ open, onClose }: KeyboardShortcutsHelpModalProps) {
  const focusTrapRef = useFocusTrap({
    isActive: open,
    initialFocus: 'button[data-initial-focus="true"]',
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-modal flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            data-testid="keyboard-shortcuts-backdrop"
            className="absolute inset-0 bg-overlay/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={focusTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
            aria-describedby="keyboard-shortcuts-description"
            className="relative z-overlay w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-surface/95 p-6 shadow-2xl"
            initial={{ scale: 0.96, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="keyboard-shortcuts-title" className="text-xl font-semibold text-foreground">
                  Keyboard shortcuts
                </h2>
                <p id="keyboard-shortcuts-description" className="mt-2 text-sm leading-6 text-foreground-muted">
                  A quick reference for the app&apos;s current keyboard controls.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close keyboard shortcuts"
                onClick={onClose}
                data-initial-focus="true"
              >
                <X size={18} />
              </Button>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-background">
              <dl className="divide-y divide-border">
                {SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.key} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="text-sm font-semibold text-foreground">{shortcut.key}</dt>
                    <dd className="text-sm text-foreground-muted">{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
