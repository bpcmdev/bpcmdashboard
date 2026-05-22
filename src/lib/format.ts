/**
 * Format a reach/views/impressions number into a compact human-readable string.
 * 28400000 -> "28.4M"
 * 4500     -> "5K"
 * Already-formatted strings ("5.7M", "—") are returned as-is.
 */
export function formatReach(val: string | number | null | undefined): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'string') {
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

/**
 * Compact dollar formatter used everywhere money is displayed outside the big KPI tile.
 *   1_600_000 -> "$1.6M"
 *   172_300   -> "$172K"
 *   809       -> "$809"
 *   0/null    -> "$0"
 */
export function formatMoney(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(Number(val))) return '$0';
  const n = Number(val);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

/**
 * Compact integer count: 1_240_000 -> "1.2M", 4_500 -> "5K", 42 -> "42".
 */
export function formatCount(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(Number(val))) return '0';
  const n = Number(val);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}
