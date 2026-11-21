/**
 * Stellar XLM balance breakdown (#1081).
 *
 * On Stellar, an account's XLM balance is not fully spendable: the protocol
 * locks a base reserve (2 XLM) plus 0.5 XLM per subentry (trustlines, offers,
 * signers, data entries) and per sponsored entry. Only the remainder can be
 * spent or transferred.
 *
 * Every value here is `number | null` — `null` means "unknown", never 0, so
 * callers can render an explicit unavailable state instead of a false zero.
 */

/** Base reserve per account, in XLM. */
export const BASE_RESERVE_XLM = 2;
/** Additional reserve per subentry, in XLM. */
export const SUBENTRY_RESERVE_XLM = 0.5;

export interface StellarReserveInput {
  /** Total XLM held by the account (native balance). */
  totalXlm?: number | null;
  /** Number of subentries (trustlines, offers, signers, data entries). */
  subentryCount?: number | null;
  /** Number of sponsored subentries (reserve paid by a sponsor). */
  sponsoredSubentries?: number | null;
  /** Number of sponsoring entries (reserve this account pays for others). */
  sponsoringEntries?: number | null;
}

export interface StellarReserveBreakdown {
  /** XLM that can actually be spent or transferred. */
  spendableXlm: number | null;
  /** XLM locked by the protocol reserve. */
  reservedXlm: number | null;
  /** Total XLM held by the account. */
  totalXlm: number | null;
  /** True when every input needed for the breakdown was available. */
  isComplete: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round7(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

/**
 * Compute the reserve breakdown. Returns `null` for any value that cannot be
 * derived from the supplied inputs; never substitutes 0 for missing data.
 */
export function computeStellarReserve(
  input: StellarReserveInput
): StellarReserveBreakdown {
  const totalXlm = isFiniteNumber(input.totalXlm) ? input.totalXlm : null;
  const subentries = isFiniteNumber(input.subentryCount)
    ? input.subentryCount
    : null;
  const sponsored = isFiniteNumber(input.sponsoredSubentries)
    ? input.sponsoredSubentries
    : 0;
  const sponsoring = isFiniteNumber(input.sponsoringEntries)
    ? input.sponsoringEntries
    : 0;

  const reservedXlm =
    subentries === null
      ? null
      : round7(
          BASE_RESERVE_XLM +
            SUBENTRY_RESERVE_XLM *
              (Math.max(0, subentries - sponsored) + Math.max(0, sponsoring))
        );

  const spendableXlm =
    totalXlm === null || reservedXlm === null
      ? null
      : round7(Math.max(0, totalXlm - reservedXlm));

  return {
    spendableXlm,
    reservedXlm,
    totalXlm,
    isComplete:
      spendableXlm !== null && reservedXlm !== null && totalXlm !== null,
  };
}

/** Format an XLM amount, or an explicit unavailable marker when unknown. */
export function formatXlm(
  value: number | null,
  unavailableLabel = "Unavailable"
): string {
  if (value === null) return unavailableLabel;
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })} XLM`;
}
