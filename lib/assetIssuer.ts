/**
 * Helpers for presenting Stellar asset identity (code + issuer + network) in
 * trade review (#806). Asset codes are not unique on Stellar — anyone can
 * issue "USDC" — so the issuer account is what actually identifies an asset.
 */

export type StellarNetworkId = "PUBLIC" | "TESTNET" | "FUTURENET";

export const NETWORK_LABELS: Record<StellarNetworkId, string> = {
  PUBLIC: "Mainnet (Public)",
  TESTNET: "Testnet",
  FUTURENET: "Futurenet",
};

/** Human-readable label for a network id; unknown ids are shown verbatim. */
export function getNetworkLabel(network: string | null | undefined): string {
  if (!network) return "Unknown network";
  const key = network.toUpperCase() as StellarNetworkId;
  return NETWORK_LABELS[key] ?? network;
}

export interface TradeAssetInfo {
  /** Asset code, e.g. "USDC" or "XLM". */
  code: string;
  /** Issuer account (G…). Omitted/null for native XLM or when unknown. */
  issuer?: string | null;
  /** Optional home domain published by the issuer, e.g. "centre.io". */
  homeDomain?: string | null;
}

/**
 * - `native`  — XLM, which has no issuer
 * - `known`   — a well-formed issuer address is present
 * - `missing` — non-native asset without issuer metadata
 * - `invalid` — issuer present but not a valid Stellar account id
 */
export type IssuerStatus = "native" | "known" | "missing" | "invalid";

const STELLAR_ACCOUNT_RE = /^G[A-Z2-7]{55}$/;

export function isValidIssuerAddress(address: string): boolean {
  return STELLAR_ACCOUNT_RE.test(address);
}

export function isNativeAsset(asset: TradeAssetInfo): boolean {
  return asset.code.toUpperCase() === "XLM" && !asset.issuer;
}

export function getIssuerStatus(asset: TradeAssetInfo): IssuerStatus {
  if (isNativeAsset(asset)) return "native";
  const issuer = asset.issuer?.trim();
  if (!issuer) return "missing";
  return isValidIssuerAddress(issuer) ? "known" : "invalid";
}

/** Issuer-provided descriptive metadata fields we can diff over time (#1085). */
export type IssuerMetadataField = "name" | "image" | "description";

export const ISSUER_METADATA_FIELD_LABELS: Record<IssuerMetadataField, string> = {
  name: "Name",
  image: "Image",
  description: "Description",
};

/** A single issuer metadata snapshot, as published at `updatedAt`. */
export interface IssuerMetadataSnapshot {
  name?: string | null;
  image?: string | null;
  description?: string | null;
  /** ISO timestamp of when this snapshot was observed. */
  updatedAt: string;
}

export interface IssuerMetadataChange {
  field: IssuerMetadataField;
  /** Previous value, or null when the field was absent/empty before. */
  previous: string | null;
  /** New value, or null when the field was removed/emptied. */
  current: string | null;
  /** ISO timestamp of the snapshot that introduced this change. */
  updatedAt: string;
}

export interface IssuerMetadataHistory {
  /** Snapshots ordered oldest → newest. */
  snapshots: IssuerMetadataSnapshot[];
}

function normalizeMetadataValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Summarizes the most recent change to an asset's issuer-provided metadata.
 *
 * Only the latest snapshot is compared with the one before it, so the result
 * describes "what changed last" rather than the full history. Returns an empty
 * array when there is no history, a single snapshot, or nothing changed — the
 * caller must treat that as "no recent changes", never as "unchanged".
 */
export function getRecentIssuerMetadataChanges(
  history: IssuerMetadataHistory | null | undefined
): IssuerMetadataChange[] {
  const snapshots = history?.snapshots ?? [];
  if (snapshots.length < 2) return [];

  const current = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  const updatedAt = current.updatedAt;
  const changes: IssuerMetadataChange[] = [];

  (Object.keys(ISSUER_METADATA_FIELD_LABELS) as IssuerMetadataField[]).forEach(
    (field) => {
      const before = normalizeMetadataValue(previous[field]);
      const after = normalizeMetadataValue(current[field]);
      if (before !== after) {
        changes.push({ field, previous: before, current: after, updatedAt });
      }
    }
  );

  return changes;
}

/**
 * Shortens a long address to `GABCDE…WXYZ12` so it stays readable while still
 * showing enough characters on both ends to compare against a wallet.
 * Strings already short enough are returned unchanged.
 */
export function shortenAddress(address: string, lead = 6, tail = 6): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Splits an address into groups of 4 characters, e.g. for screen readers or a
 * full-address display that is easier to compare by eye.
 */
export function groupAddress(address: string, size = 4): string {
  return address.match(new RegExp(`.{1,${size}}`, "g"))?.join(" ") ?? address;
}
