import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Sparkles, Handshake, Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { formatMoney, formatCount } from '@/lib/format';

interface NotableItem {
  id: string;
  icon: 'mover-up' | 'mover-down' | 'spike' | 'partnership' | 'post';
  label: string;
  headline: string;
  detail?: string;
}

const ICON_MAP = {
  'mover-up': TrendingUp,
  'mover-down': TrendingDown,
  'spike': Sparkles,
  'partnership': Handshake,
  'post': Megaphone,
} as const;

const METRIC_LABELS: Record<string, { label: string; fmt: (n: number) => string }> = {
  placement_count: { label: 'Press Placements', fmt: (n) => `${Math.round(n)}` },
  emv_usd: { label: 'Earned Media Value', fmt: formatMoney },
  social_reach: { label: 'Social Reach', fmt: formatCount },
  sentiment_score: { label: 'Sentiment', fmt: (n) => `${Math.round(n)}` },
  sov_pct: { label: 'Share of Voice', fmt: (n) => `${n.toFixed(1)}%` },
  influencer_roi: { label: 'Influencer ROI', fmt: (n) => `${n.toFixed(1)}x` },
};

const SPIKE_THRESHOLD = 0.5; // >50% WoW change

const NotableThisWeek = () => {
  const { activeClientId, selectedWeek, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const { clientColor } = useAdmin();
  const accent = clientColor || '#1B2B8A';
  const [items, setItems] = useState<NotableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAllTime || !activeClientId || !selectedWeek || !effectiveFrom || !effectiveTo) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const next: NotableItem[] = [];

      // Prior week start
      const priorStart = new Date(selectedWeek + 'T00:00:00');
      priorStart.setDate(priorStart.getDate() - 7);
      const priorIso = priorStart.toISOString().split('T')[0];

      const [cur, prev, parts, posts] = await Promise.all([
        supabase.from('weekly_snapshots').select('*').eq('client_id', activeClientId).eq('week_start', selectedWeek).maybeSingle(),
        supabase.from('weekly_snapshots').select('*').eq('client_id', activeClientId).eq('week_start', priorIso).maybeSingle(),
        supabase.from('partnerships').select('partner_name, start_date, status, emv_generated').eq('client_id', activeClientId).gte('start_date', effectiveFrom).lte('start_date', effectiveTo),
        supabase.from('lefty_posts').select('id, author_name, campaign_name, reach, emv, network').eq('client_id', activeClientId).gte('posted_at', effectiveFrom).lte('posted_at', `${effectiveTo}T23:59:59.999Z`).order('reach', { ascending: false }).limit(5),
      ]);

      if (cancelled) return;

      const c = (cur.data ?? null) as Record<string, any> | null;
      const p = (prev.data ?? null) as Record<string, any> | null;

      // Biggest mover across the 6 main metrics (compare to prior week, >50% change)
      if (c && p) {
        const movers: { key: string; pct: number; delta: number; curVal: number }[] = [];
        for (const key of Object.keys(METRIC_LABELS)) {
          const curVal = Number(c[key]) || 0;
          const prevVal = Number(p[key]) || 0;
          if (!prevVal || !curVal) continue;
          const pct = (curVal - prevVal) / Math.abs(prevVal);
          if (Math.abs(pct) >= SPIKE_THRESHOLD) {
            movers.push({ key, pct, delta: curVal - prevVal, curVal });
          }
        }
        movers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
        const top = movers.slice(0, 2);
        for (const m of top) {
          const meta = METRIC_LABELS[m.key];
          const up = m.pct > 0;
          next.push({
            id: `mover-${m.key}`,
            icon: up ? 'mover-up' : 'mover-down',
            label: up ? 'Biggest Mover' : 'Notable Drop',
            headline: `${meta.label} ${up ? '↑' : '↓'} ${Math.round(Math.abs(m.pct) * 100)}%`,
            detail: `${meta.fmt(m.curVal)} this week · was ${meta.fmt(Number(p[m.key]))} last week`,
          });
        }
      }

      // New partnerships going live this week
      const newParts = (parts.data ?? []).filter((x: any) => x.status && x.status !== 'past').slice(0, 2);
      for (const part of newParts) {
        next.push({
          id: `part-${part.partner_name}`,
          icon: 'partnership',
          label: 'New Partnership Live',
          headline: part.partner_name,
          detail: part.emv_generated ? `${formatMoney(part.emv_generated)} projected EMV` : 'Activation started this week',
        });
      }

      // Reach spike: top post if reach > 2× median of the rest
      const postRows = (posts.data ?? []) as Array<{ id: string; author_name: string | null; campaign_name: string | null; reach: number | null; emv: number | null; network: string | null }>;
      if (postRows.length >= 1) {
        const top = postRows[0];
        const rest = postRows.slice(1).map(x => x.reach || 0).filter(x => x > 0);
        const median = rest.length ? rest.sort((a, b) => a - b)[Math.floor(rest.length / 2)] : 0;
        if ((top.reach ?? 0) > 0 && (median === 0 || (top.reach ?? 0) > median * 2)) {
          next.push({
            id: `post-${top.id}`,
            icon: 'post',
            label: 'Top Performing Post',
            headline: `${top.author_name ?? 'Creator'} · ${formatCount(top.reach ?? 0)} reach`,
            detail: top.campaign_name ? `${top.campaign_name}${top.emv ? ` · ${formatMoney(top.emv)} EMV` : ''}` : top.emv ? `${formatMoney(top.emv)} EMV` : undefined,
          });
        }
      }

      setItems(next.slice(0, 4));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, selectedWeek, effectiveFrom, effectiveTo, isAllTime, refreshKey]);

  if (isAllTime) return null;
  if (!loading && items.length === 0) return null;

  return (
    <div className="bg-white border-b border-black/10 px-4 md:px-6 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono-ui text-[9px] tracking-[0.22em] uppercase text-muted-foreground">
          Notable This Week
        </span>
        <span className="h-px flex-1 bg-black/[0.08]" />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-black/[0.04] animate-pulse rounded-sm" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {items.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const iconColor = item.icon === 'mover-down' ? 'hsl(0 72% 50%)' : accent;
            return (
              <div
                key={item.id}
                className="flex items-start gap-2.5 px-3 py-2.5 border border-black/[0.08] hover:border-black/20 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-12px_rgba(0,0,0,0.18)] transition-all duration-200 animate-fade-in bg-white"
              >
                <span
                  className="flex items-center justify-center w-7 h-7 shrink-0 rounded-sm"
                  style={{ backgroundColor: `${iconColor}15`, color: iconColor }}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono-ui text-[8.5px] tracking-[0.18em] uppercase text-muted-foreground leading-tight">
                    {item.label}
                  </p>
                  <p className="text-[12px] font-semibold text-foreground truncate leading-snug mt-0.5">
                    {item.headline}
                  </p>
                  {item.detail && (
                    <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{item.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotableThisWeek;
