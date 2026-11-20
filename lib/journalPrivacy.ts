/** Placeholder shown instead of a financial value while private mode is on. */
export const PRIVATE_MASK = "••••";

/**
 * Returns the display text for a financial value. Only the display changes: the
 * stored value, exports and other pages are never affected.
 */
export function maskValue(value: string, masked: boolean): string {
  return masked ? PRIVATE_MASK : value;
}

/** Text announced to assistive technology when private mode changes. */
export function privateModeAnnouncement(masked: boolean): string {
  return masked
    ? "Private mode on. Financial values in the journal are hidden."
    : "Private mode off. Financial values in the journal are visible.";
}
