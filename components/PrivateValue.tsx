"use client";

import type { ReactNode } from "react";
import { maskValue } from "@/lib/journalPrivacy";
import { useJournalPrivacyStore } from "@/store/useJournalPrivacyStore";

interface PrivateValueProps {
  /** Text shown when values are visible; also what screen readers get then. */
  children: string | ReactNode;
  /** Plain-text form of the value, used when the children are not a string. */
  text?: string;
}

/** Wraps a financial value on the journal page so it can be masked on demand. */
export function PrivateValue({ children, text }: PrivateValueProps) {
  const masked = useJournalPrivacyStore((state) => state.masked);
  if (!masked) return <>{children}</>;
  return (
    <span aria-label="Hidden value" data-private="true">
      {maskValue(typeof children === "string" ? children : text ?? "", true)}
    </span>
  );
}
