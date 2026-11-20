"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { privateModeAnnouncement } from "@/lib/journalPrivacy";
import { useJournalPrivacyStore } from "@/store/useJournalPrivacyStore";

/** Masks or reveals financial values on the journal page. Announces every change. */
export function JournalPrivacyToggle() {
  const masked = useJournalPrivacyStore((state) => state.masked);
  const toggle = useJournalPrivacyStore((state) => state.toggle);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={toggle}
        aria-pressed={masked}
        className="gap-2"
        data-testid="journal-private-toggle"
      >
        {masked ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {masked ? "Show values" : "Hide values"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {privateModeAnnouncement(masked)}
      </span>
    </>
  );
}
