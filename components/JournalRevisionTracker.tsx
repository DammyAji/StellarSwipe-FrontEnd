"use client";

import { useEffect } from "react";
import { trackJournalRevisions } from "@/store/useJournalRevisionStore";

/** Renders nothing; records journal entry versions while the journal page is open. */
export function JournalRevisionTracker() {
  useEffect(() => trackJournalRevisions(), []);
  return null;
}
