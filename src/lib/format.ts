/**
 * Format a reach/views/impressions number into a compact human-readable string.
 * 28400000 -> "28.4M"
 * 4500     -> "5K"
 * Already-formatted strings ("5.7M", "—") are returned as-is.
 */
export function formatReach(val: string | number | null | undefined): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'string') {
    // If it already contains a non-digit (M, K, %, ., letters), leave it alone.
    const trimmed = val.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
    return formatReach(Number(trimmed));
  }
  const n = Number(val);
  if (!Number.isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
