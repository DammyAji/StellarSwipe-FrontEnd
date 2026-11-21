import type { TransactionDetails } from "@/store/useTransactionStore";

export function getTransactionExplorerUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(hash)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/**
 * Builds a compact, printable HTML receipt from confirmed trade details only.
 * Missing fields are shown as "Not available" rather than guessed, and no
 * account or wallet data is included.
 */
export function buildTradeReceiptHtml(details: TransactionDetails): string {
  const show = (v: string | undefined) =>
    v && v.trim() ? escapeHtml(v) : "Not available";
  const time = Number.isFinite(details.timestamp)
    ? new Date(details.timestamp).toLocaleString()
    : "Not available";
  const rows: [string, string][] = [
    ["Token", show(details.token)],
    ["Amount", show(details.amount)],
    ["Price", show(details.price)],
    ["Fee", show(details.fee)],
    ["Confirmed at", escapeHtml(time)],
    ["Transaction hash", show(details.hash)],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Trade receipt</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:24px auto;padding:0 16px;color:#111}
h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:6px 0;border-bottom:1px solid #ddd;vertical-align:top}td:last-child{text-align:right;word-break:break-all}
p{font-size:11px;color:#555}</style></head><body>
<h1>StellarSwipe trade receipt</h1><table>${rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("")}</table>
<p>Verify on Stellar Expert: ${details.hash ? escapeHtml(getTransactionExplorerUrl(details.hash)) : "Not available"}</p>
</body></html>`;
}

/** Downloads the receipt as an HTML file. Throws if the download cannot be generated. */
export function downloadTradeReceipt(details: TransactionDetails): void {
  if (!details.hash) throw new Error("Trade is missing a transaction hash");
  const blob = new Blob([buildTradeReceiptHtml(details)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `stellarswipe-receipt-${details.hash.slice(0, 8)}.html`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
