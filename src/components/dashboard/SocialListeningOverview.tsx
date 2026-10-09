/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { formatCount } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import SocialListeningKpis from '@/components/dashboard/SocialListeningKpis';
import SocialListeningSourceMix from '@/components/dashboard/SocialListeningSourceMix';
import SocialListeningSentiment from '@/components/dashboard/SocialListeningSentiment';

/* ------------------------------------------------------------------------------------------------
 * Social Listening — all-channel overview (Brand24 → n8n → Supabase)
 * RPCs: listening_overview (daily metrics by source), listening_insights (weekly snapshots)
 * ---------------------------------------------------------------------------------------------- */

interface Kpis {
  mentions: number; reach: number; positive: number; negative: number; ave: number;
  social_mentions: number; non_social_mentions: number; social_reach: number; non_social_reach: number;
  social_reactions: number; social_comments: number; social_shares: number; social_interactions: number;
}

interface SourceRow { source: string; mentions: number; positive: number; negative: number; neutral: number; reach: number }

interface Overview {
  data_since: string | null;
  current: Partial<Kpis>;
  prior: Partial<Kpis> | null;
  sources: SourceRow[];
}

interface Voice { name: string | null; url: string | null; followers: number | null; mentions: number | null; reach: number | null; share_of_reach?: number | null }

interface Insights {
  weeks_covered: number;
  hashtags: { hashtag: string; mentions: number; reach: number | null; sentiment: number | null }[];
  sites: { domain: string; mentions: number; reach: number | null }[];
  voices_by_reach: Voice[];
  voices_by_followers: Voice[];
  hot_hours: { day_of_week: number; hour: number; mentions: number }[];
}

const SOURCES: Record<string, { label: string; color: string }> = {
  tiktok:    { label: 'TikTok',    color: 'hsl(174 60% 33%)' },
  twitter:   { label: 'X',         color: 'hsl(0 0% 15%)' },
  x:         { label: 'X',         color: 'hsl(0 0% 15%)' },
  youtube:   { label: 'YouTube',   color: 'hsl(0 72% 46%)' },
  reddit:    { label: 'Reddit',    color: 'hsl(16 85% 50%)' },
  instagram: { label: 'Instagram', color: 'hsl(330 65% 48%)' },
  facebook:  { label: 'Facebook',  color: 'hsl(214 80% 48%)' },
  news:      { label: 'News',      color: 'hsl(225 70% 35%)' },
  other:     { label: 'Blogs, web & podcasts', color: 'hsl(42 64% 45%)' },
};
const sourceMeta = (s: string) => SOURCES[s] ?? { label: s.charAt(0).toUpperCase() + s.slice(1), color: 'hsl(0 0% 60%)' };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

type PanelId = 'voices' | 'followed' | 'hashtags' | 'sites';
const PANELS: { id: PanelId; label: string; note: string }[] = [
  { id: 'voices',   label: 'Top voices',        note: 'By estimated reach' },
  { id: 'followed', label: 'Most followed',     note: 'By follower count' },
  { id: 'hashtags', label: 'Trending hashtags', note: 'Most mentions first' },
  { id: 'sites',    label: 'Most active sites', note: 'Most mentions first' },
];

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function hostOf(url: string | null): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{children}</h3>
      {right}
    </div>
  );
}

function VoiceTable({ rows, mode }: { rows: Voice[]; mode: 'reach' | 'followers' }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-4">No voices recorded in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground border-b border-border">
            <th className="py-2 font-medium">Profile</th>
            <th className="py-2 font-medium text-right">Mentions</th>
            <th className="py-2 font-medium text-right">Reach</th>
            <th className="py-2 font-medium text-right">{mode === 'reach' ? 'Share of reach' : 'Followers'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v, i) => (
            <tr key={`${v.url ?? v.name}-${i}`} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">
                {v.url
                  ? <a href={v.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{v.name || hostOf(v.url)}</a>
                  : <span className="font-semibold">{v.name}</span>}
                <span className="block text-[11px] text-muted-foreground">{hostOf(v.url)}</span>
              </td>
              <td className="py-2 text-right tabular-nums">{formatCount(num(v.mentions))}</td>
              <td className="py-2 text-right tabular-nums">{formatCount(num(v.reach))}</td>
              <td className="py-2 text-right tabular-nums font-semibold">
                {mode === 'reach' ? `${num(v.share_of_reach).toFixed(1)}%` : formatCount(num(v.followers))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================================================== */

const SocialListeningOverview = () => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState<PanelId>('voices');

  const range = useMemo(() => {
    if (isAllTime || !effectiveFrom || !effectiveTo) return { p_start: null, p_end: null };
    return { p_start: effectiveFrom, p_end: effectiveTo };
  }, [isAllTime, effectiveFrom, effectiveTo]);

  useEffect(() => {
    if (!activeClientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      const base = { p_client_id: activeClientId, ...range };
      const [o, i] = await Promise.all([
        supabase.rpc('listening_overview' as any, base),
        supabase.rpc('listening_insights' as any, { ...base, p_limit: 8 }),
      ]);
      if (cancelled) return;
      if (o.error || i.error) {
        console.error('Social listening overview RPC failed:', o.error || i.error);
        setError(true);
        setLoading(false);
        return;
      }
      setOverview((o.data ?? null) as Overview | null);
      setInsights((i.data ?? null) as Insights | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, refreshKey]);

  const sources = useMemo(() => arr<SourceRow>(overview?.sources).filter(s => num(s.mentions) > 0), [overview]);

  const heat = useMemo(() => {
    const cells = new Map<string, number>();
    let max = 0;
    let best: { d: number; h: number; v: number } | null = null;
    for (const c of arr<Insights['hot_hours'][number]>(insights?.hot_hours)) {
      const d = num(c.day_of_week); const h = num(c.hour); const v = num(c.mentions);
      if (d < 1 || d > 7 || h < 0 || h > 23) continue;
      cells.set(`${d}-${h}`, v);
      if (v > max) { max = v; best = { d, h, v }; }
    }
    return { cells, max, best };
  }, [insights]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <div className="grid lg:grid-cols-2 gap-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">The listening overview could not be loaded. Refresh the page to try again.</p>;
  if (!overview || !num(overview.current?.mentions)) return null;

  const c = overview.current as Kpis;

  return (
    <div className="space-y-6">
      {/* ---------- KPI cards (interactive) ---------- */}
      <SocialListeningKpis overview={overview} />

      {/* ---------- Sentiment + mix by source ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SocialListeningSentiment sources={sources} />

        <SocialListeningSourceMix sources={sources} />
      </div>

      {/* ---------- Voices, hashtags and sites (one panel at a time) ---------- */}
      {insights && (
        <div className="section-card border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div role="tablist" aria-label="Voices, hashtags and sites" className="flex flex-wrap gap-1">
              {PANELS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  id={`listening-tab-${p.id}`}
                  aria-selected={panel === p.id}
                  aria-controls="listening-panel"
                  onClick={() => setPanel(p.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2',
                    panel === p.id
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">{PANELS.find(p => p.id === panel)?.note}</span>
          </div>

          <div role="tabpanel" id="listening-panel" aria-labelledby={`listening-tab-${panel}`}>
            {panel === 'voices' && <VoiceTable rows={arr<Voice>(insights.voices_by_reach)} mode="reach" />}
            {panel === 'followed' && <VoiceTable rows={arr<Voice>(insights.voices_by_followers)} mode="followers" />}
            {panel === 'hashtags' && (
              arr(insights.hashtags).length ? (
                <ul className="divide-y divide-border">
                  {arr<Insights['hashtags'][number]>(insights.hashtags).map(h => (
                    <li key={h.hashtag} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-semibold">{h.hashtag.startsWith('#') ? h.hashtag : `#${h.hashtag}`}</span>
                      <span className="text-muted-foreground tabular-nums">{formatCount(num(h.mentions))} mentions</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No hashtags recorded in this period.</p>
            )}
            {panel === 'sites' && (
              arr(insights.sites).length ? (
                <ul className="divide-y divide-border">
                  {arr<Insights['sites'][number]>(insights.sites).map(s => (
                    <li key={s.domain} className="flex items-center justify-between py-2 text-sm">
                      <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{s.domain}</a>
                      <span className="text-muted-foreground tabular-nums">{formatCount(num(s.mentions))} mentions</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No sites recorded in this period.</p>
            )}
          </div>
        </div>
      )}

      {/* ---------- Hot hours ---------- */}
      {insights && heat.max > 0 && (
        <div className="section-card border p-5">
          <SectionTitle>When mentions happen</SectionTitle>
          {heat.best && (
            <p className="text-sm mb-4">
              Mentions cluster most on <span className="font-semibold">{DAYS[heat.best.d - 1]} at {hourLabel(heat.best.h)}</span>.
            </p>
          )}
          <div className="overflow-x-auto">
            <div className="grid gap-1 min-w-[640px]" style={{ gridTemplateColumns: '40px repeat(24, minmax(0, 1fr))' }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-[9px] text-muted-foreground text-center">{h % 3 === 0 ? hourLabel(h) : ''}</div>
              ))}
              {DAYS.map((day, di) => (
                <Fragment key={day}>
                  <div className="text-[11px] text-muted-foreground flex items-center">{day}</div>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const v = heat.cells.get(`${di + 1}-${h}`);
                    const t = v ? v / heat.max : 0;
                    return (
                      <div
                        key={h}
                        className="aspect-square rounded-full"
                        style={{ backgroundColor: v ? `hsl(255 45% ${88 - t * 52}%)` : 'hsl(0 0% 92%)' }}
                        title={v ? `${day} ${hourLabel(h)}: ${v.toFixed(1)} mentions on average` : `${day} ${hourLabel(h)}: low activity`}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Darker means more mentions in that hour on average. Brand24 reports the busiest 24 hours of the week; the rest show as low activity.</p>
        </div>
      )}
    </div>
  );
};

export default SocialListeningOverview;