import { useState, useEffect, useMemo } from 'react';
import { ExternalLink, ImageIcon, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatReach } from '@/lib/format';

// ---------- AI Shopping Visibility ----------
interface ShoppingProductRow {
  product_id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  visibility: number | null;
  share_of_voice: number | null;
  avg_position: number | null;
  mention_count: number | null;
  win_count: number | null;
  price_range: Record<string, { min: number; max: number }> | null;
  categories: (string | ProductCategory)[] | null;
  captured_date?: string | null;
}

const fmtPriceRange = (pr: ShoppingProductRow['price_range']): string | null => {
  if (!pr || typeof pr !== 'object') return null;
  const entries = Object.entries(pr);
  if (entries.length === 0) return null;
  const usd = pr['USD'];
  const [currency, range] = usd ? ['USD', usd] : entries[0];
  if (!range || range.min == null || range.max == null) return null;
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString()}${sym ? '' : ' ' + currency}`;
  return range.min === range.max ? fmt(range.min) : `${fmt(range.min)}–${fmt(range.max)}`;
};

const positionTier = (p: number | null | undefined): string => {
  if (p == null) return '—';
  if (p <= 3) return 'Top 3';
  if (p <= 5) return 'Top 5';
  if (p <= 10) return 'Featured';
  return 'Present';
};

const positionTierDetail = (p: number | null | undefined): string => {
  if (p == null) return '—';
  const n = Number(p).toFixed(1);
  if (p <= 3) return `Top 3 · #${n}`;
  if (p <= 5) return `Top 5 · #${n}`;
  if (p <= 10) return `Featured · #${n}`;
  return `Present · #${n}`;
};

interface ProductCategory { id?: string | null; name?: string | null; path?: string | null }
interface ProductDetail {
  name?: string | null;
  brand?: string | null;
  image_url?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  visibility?: number | null;
  visibility_delta?: number | null;
  win_rate?: number | null;
  win_count?: number | null;
  avg_position?: number | null;
  position_delta?: number | null;
  mention_count?: number | null;
  mentions_delta?: number | null;
  compared_to?: string | null;
  categories?: (ProductCategory | string)[] | null;
}
interface ProductTrendRow {
  point_date: string;
  visibility?: number | null;
  win_rate?: number | null;
  avg_position?: number | null;
  sov?: number | null;
  has_data?: boolean | null;
}
interface ProductMerchantRow {
  merchant_id?: string | null;
  name?: string | null;
  domain?: string | null;
  mention_count?: number | null;
  share_of_voice?: number | null;
  win_rate?: number | null;
  avg_position?: number | null;
  avg_rating?: number | null;
}
interface ProductQueryRow {
  query_text?: string | null;
  distinct_chat_count?: number | null;
  distinct_chat_count_previous?: number | null;
}
interface ProductTermRow {
  term?: string | null;
  distinct_chat_count?: number | null;
  distinct_chat_count_previous?: number | null;
}
interface ProductCompetitorRow {
  competitor_product_id: string;
  name?: string | null;
  brand?: string | null;
  image_url?: string | null;
  visibility?: number | null;
  mention_count?: number | null;
  avg_position?: number | null;
}

type TrendBucket = 'day' | 'week' | 'month';

const deltaOf = (cur?: number | null, prev?: number | null): number | null => {
  if (prev == null) return null;
  return Number(cur ?? 0) - Number(prev);
};

const StarRating = ({ value }: { value: number }) => {
  const rounded = Math.round(value);
  return (
    <span className="text-[11px] text-amber-500 tracking-tight" title={`${value.toFixed(1)} / 5`}>
      {'★'.repeat(Math.max(0, Math.min(5, rounded)))}
      <span className="text-muted-foreground">{'★'.repeat(Math.max(0, 5 - Math.max(0, Math.min(5, rounded))))}</span>
    </span>
  );
};

const DeltaText = ({ value, unit, invert = false }: { value: number | null | undefined; unit?: string; invert?: boolean }) => {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n === 0) return <div className="text-[11px] font-mono text-muted-foreground mt-0.5">0{unit ?? ''}</div>;
  const good = invert ? n < 0 : n > 0;
  return (
    <div className={`text-[11px] font-mono mt-0.5 ${good ? 'text-emerald-600' : 'text-red-600'}`}>
      {n > 0 ? '+' : ''}{n.toFixed(2)}{unit ?? ''}
    </div>
  );
};

const ProductDetailSheetBody = ({
  product, clientId, accent,
}: { product: ShoppingProductRow; clientId: string | null; accent: string }) => {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [trend, setTrend] = useState<ProductTrendRow[]>([]);
  const [bucket, setBucket] = useState<TrendBucket>('week');
  const [merchants, setMerchants] = useState<ProductMerchantRow[]>([]);
  const [queries, setQueries] = useState<ProductQueryRow[]>([]);
  const [terms, setTerms] = useState<ProductTermRow[]>([]);
  const [competitors, setCompetitors] = useState<ProductCompetitorRow[]>([]);

  useEffect(() => {
    if (!clientId || !product?.product_id) return;
    let cancelled = false;
    setDetail(null);
    setMerchants([]);
    setQueries([]);
    setTerms([]);
    setCompetitors([]);
    (async () => {
      try {
        const [d, m, q, tm, cm] = await Promise.all([
          supabase.rpc('peec_product_detail', { p_client_id: clientId, p_product_id: product.product_id }),
          supabase.rpc('peec_product_merchants', { p_client_id: clientId, p_product_id: product.product_id }),
          supabase.rpc('peec_product_shopping_queries', { p_client_id: clientId, p_product_id: product.product_id, p_limit: 10 }),
          supabase.rpc('peec_product_query_terms', { p_client_id: clientId, p_product_id: product.product_id, p_limit: 12 }),
          supabase.rpc('peec_product_competitors', { p_client_id: clientId, p_product_id: product.product_id, p_limit: 8 }),
        ]);
        if (cancelled) return;
        const dRow = Array.isArray(d.data) ? d.data[0] : d.data;
        setDetail((dRow as ProductDetail) ?? null);
        setMerchants(Array.isArray(m.data) ? (m.data as ProductMerchantRow[]) : []);
        setQueries(Array.isArray(q.data) ? (q.data as ProductQueryRow[]) : []);
        setTerms(Array.isArray(tm.data) ? (tm.data as ProductTermRow[]) : []);
        setCompetitors(Array.isArray(cm.data) ? (cm.data as ProductCompetitorRow[]) : []);
      } catch (e) {
        console.error('[ProductDetail] load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, product?.product_id]);

  useEffect(() => {
    if (!clientId || !product?.product_id) return;
    let cancelled = false;
    setTrend([]);
    (async () => {
      try {
        const { data } = await supabase.rpc('peec_product_trend_v2', {
          p_client_id: clientId, p_product_id: product.product_id, p_bucket: bucket,
        });
        if (!cancelled) setTrend(Array.isArray(data) ? (data as ProductTrendRow[]) : []);
      } catch (e) {
        console.error('[ProductTrend] load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, product?.product_id, bucket]);

  const name = detail?.name || product.name;
  const brand = detail?.brand ?? product.brand;
  const image = detail?.image_url ?? product.image_url;
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();

  const visibility = detail?.visibility ?? product.visibility ?? null;
  const visPct = visibility != null ? (Number(visibility) * 100).toFixed(1) : '—';
  const winRate = detail?.win_rate;
  const avg = detail?.avg_position ?? product.avg_position;
  const mentions = detail?.mention_count ?? product.mention_count ?? 0;
  const wins = detail?.win_count ?? product.win_count ?? 0;
  const winsValue = wins === 0
    ? 'Emerging'
    : wins <= 2
      ? `Rising · ${wins} time${wins === 1 ? '' : 's'}`
      : `Leading · ${wins} time${wins === 1 ? '' : 's'}`;

  const priceMin = detail?.price_min;
  const priceMax = detail?.price_max;
  const priceLabel = priceMin != null
    ? (priceMax == null || priceMax === priceMin
        ? `$${Math.round(Number(priceMin)).toLocaleString()}`
        : `$${Math.round(Number(priceMin)).toLocaleString()}–$${Math.round(Number(priceMax)).toLocaleString()}`)
    : fmtPriceRange(product.price_range);

  const cats: ProductCategory[] = (detail?.categories ?? product.categories ?? [])
    .map((c) => (typeof c === 'string' ? { name: c } : c))
    .filter((c) => c && c.name);

  const chartData = trend
    .filter((r) => r.point_date)
    .map((r) => {
      const hasData = r.has_data !== false;
      return {
        point_date: r.point_date,
        visibility: hasData && r.visibility != null ? Number(r.visibility) * 100 : null,
        win_rate: hasData && r.win_rate != null ? Number(r.win_rate) : null,
      };
    });

  return (
    <div className="space-y-6">
      <SheetHeader>
        <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">AI Shopping</div>
        <SheetTitle className="text-xl leading-tight">{name}</SheetTitle>
        {brand && <div className="text-sm text-muted-foreground">{brand}</div>}
        {priceLabel && <div className="text-sm font-mono tabular-nums text-foreground">{priceLabel}</div>}
      </SheetHeader>

      {image ? (
        <img src={image} alt="" className="w-full h-[200px] rounded object-contain bg-muted" />
      ) : (
        <div className="w-full h-[200px] rounded bg-muted flex items-center justify-center text-5xl font-semibold text-muted-foreground">
          {initial}
        </div>
      )}

      <div>
        <div className="grid grid-cols-5 gap-px bg-border border border-border">
          {[
            { label: 'Visibility', value: `${visPct}${visibility != null ? '%' : ''}`, delta: <DeltaText value={detail?.visibility_delta} unit=" pts" /> },
            { label: 'Win Rate', value: winRate != null ? `${Number(winRate).toFixed(1)}%` : '—', delta: null },
            { label: 'Avg Position', value: positionTierDetail(avg), delta: <DeltaText value={detail?.position_delta} invert /> },
            { label: 'Mentions', value: Number(mentions).toLocaleString(), delta: <DeltaText value={detail?.mentions_delta} /> },
            { label: 'AI Top Picks', value: winsValue, delta: null },
          ].map((s) => (
            <div key={s.label} className="bg-card p-2.5">
              <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-muted-foreground leading-tight">{s.label}</div>
              <div className="text-sm font-semibold text-foreground mt-1 tabular-nums leading-tight">{s.value}</div>
              {s.delta}
            </div>
          ))}
        </div>
        {detail?.compared_to && (
          <div className="text-[11px] text-muted-foreground mt-2">Compared to {detail.compared_to}</div>
        )}
      </div>

      {cats.length > 0 && (
        <div>
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-2">Categories</div>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c, i) => (
              <span
                key={`${c.name}-${i}`}
                title={c.path || c.name || undefined}
                className="text-[11px] px-2 py-0.5 border border-border rounded-sm text-foreground"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {chartData.length >= 3 && (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Visibility &amp; win rate</div>
              <div className="text-[11px] text-muted-foreground mt-1 mb-2">Discrete {bucket} buckets, tracked over time</div>
            </div>
            <div className="flex gap-1 shrink-0">
              {([['day', 'D'], ['week', 'W'], ['month', 'M']] as [TrendBucket, string][]).map(([b, label]) => (
                <button
                  key={b}
                  onClick={() => setBucket(b)}
                  className={`text-[10px] font-bold w-6 h-6 rounded-full border transition-colors ${
                    bucket === b ? 'text-white border-transparent' : 'text-muted-foreground border-border hover:text-foreground'
                  }`}
                  style={bucket === b ? { background: accent } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="point_date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => { try { return format(parseISO(String(v)), 'MMM d'); } catch { return String(v); } }}
                stroke="hsl(var(--border))"
              />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 2, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                formatter={(v: number, n: string) => [`${Number(v).toFixed(1)}%`, n === 'visibility' ? 'Visibility' : 'Win rate']}
              />
              <Line type="monotone" dataKey="visibility" stroke={accent} strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="win_rate" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {merchants.length > 0 && (
        <div>
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Merchants</div>
          <div className="text-[11px] text-muted-foreground mt-1 mb-2">Where AI is sending shoppers for this product</div>
          <div className="divide-y divide-border border border-border">
            {merchants.map((m, i) => (
              <div key={m.merchant_id ?? `${m.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{m.name || m.domain || '—'}</span>
                    {m.avg_rating != null && <StarRating value={Number(m.avg_rating)} />}
                  </div>
                  {m.domain && <div className="text-[11px] text-muted-foreground truncate">{m.domain}</div>}
                </div>
                <div className="text-sm font-mono tabular-nums text-foreground shrink-0">
                  {m.share_of_voice != null ? `${Math.round(Number(m.share_of_voice) * (Number(m.share_of_voice) <= 1 ? 100 : 1))}%` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {queries.length > 0 && (
        <div>
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Query fanouts</div>
          <div className="text-[11px] text-muted-foreground mt-1 mb-2">Additional queries AI ran to gather context for this product</div>
          <div className="divide-y divide-border border border-border">
            {queries.map((q, i) => {
              const d = deltaOf(q.distinct_chat_count, q.distinct_chat_count_previous);
              return (
                <div key={`${q.query_text}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0 text-sm text-foreground truncate" title={q.query_text || undefined}>{q.query_text || '—'}</div>
                  <div className="text-sm font-mono tabular-nums text-foreground shrink-0">{Number(q.distinct_chat_count ?? 0).toLocaleString()}</div>
                  <div className="w-10 text-right text-[11px] font-mono shrink-0">
                    {d == null || d === 0
                      ? <span className="text-muted-foreground">—</span>
                      : d > 0
                        ? <span className="text-emerald-600">↑{d}</span>
                        : <span className="text-red-600">↓{Math.abs(d)}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {terms.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-2">Common terms</div>
              <div className="flex flex-wrap gap-1.5">
                {terms.map((t, i) => {
                  const d = deltaOf(t.distinct_chat_count, t.distinct_chat_count_previous);
                  const dot = d == null || d === 0 ? 'bg-muted-foreground/40' : d > 0 ? 'bg-emerald-600' : 'bg-red-600';
                  return (
                    <span key={`${t.term}-${i}`} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 border border-border rounded-full text-foreground">
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                      {t.term} ({Number(t.distinct_chat_count ?? 0).toLocaleString()})
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {competitors.length > 0 && (
        <div>
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Competing products</div>
          <div className="text-[11px] text-muted-foreground mt-1 mb-3">Products that appear in the same AI searches as this one</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {competitors.map((c, i) => {
              const cvis = c.visibility != null ? `${Math.round(Number(c.visibility) * 100)}%` : '—';
              return (
                <div
                  key={c.competitor_product_id ?? `${c.name}-${i}`}
                  className="border border-border bg-card p-3 flex flex-col"
                >
                  <div className="w-full h-[80px] rounded bg-muted flex items-center justify-center mb-3 overflow-hidden">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mt-auto">
                    <div className="text-xs font-semibold text-foreground line-clamp-2 leading-tight" title={c.name || undefined}>
                      {c.name || '—'}
                    </div>
                    {c.brand && <div className="text-[11px] text-muted-foreground truncate mt-1">{c.brand}</div>}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <span className="text-[10px] font-mono font-semibold tabular-nums text-foreground bg-muted px-1.5 py-0.5 rounded">
                      {cvis}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Number(mentions) > 0 && (() => {
        const m = Number(mentions);
        const s = m === 1 ? '' : 's';
        let sentence: string;
        if (wins > 0 && avg != null) {
          const winS = wins === 1 ? '' : 's';
          sentence = `${name} was recommended by AI assistants ${m} time${s} this period, ranking in the top ${Math.ceil(avg)} on average — and placed #1 ${wins} time${winS}.`;
        } else if (avg != null && avg <= 3) {
          sentence = `${name} appeared in ${m} AI shopping response${s} this period, consistently placed in the top 3 — a strong signal of growing AI presence.`;
        } else {
          sentence = `${name} was featured in ${m} AI shopping response${s} this period, building its presence across AI recommendations.`;
        }
        return <p className="text-sm text-muted-foreground leading-relaxed">{sentence}</p>;
      })()}
    </div>
  );
};

// ---------- GEO summary ----------
interface GeoSummaryStat { label: string; value: string; detail: string }
interface GeoSummaryRecommendation { title: string; action: string; rationale: string }
interface GeoSummaryRow {
  headline: string | null;
  key_stats: GeoSummaryStat[] | null;
  narrative: string | null;
  recommendations: GeoSummaryRecommendation[] | null;
  generated_at: string | null;
}

const GeoSummaryCard = ({ clientId }: { clientId: string | null }) => {
  const { isAdmin } = useAdmin();
  const [row, setRow] = useState<GeoSummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    if (!clientId) { setRow(null); setLoading(false); return; }
    const { data, error } = await supabase.rpc('peec_product_shopping_summary_latest', { p_client_id: clientId });
    if (error) console.error('[GeoSummary] load failed', error);
    const r = Array.isArray(data) ? data[0] : data;
    setRow((r as GeoSummaryRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setErrorMsg(null);
    const { data, error } = await supabase.functions.invoke('peec-product-geo-insight', {
      body: { client_id: clientId, limit: 24 },
    });
    if (error || (data && (data as { error?: string }).error)) {
      setErrorMsg((data as { error?: string })?.error || error?.message || 'Failed to regenerate summary.');
      setRegenerating(false);
      return;
    }
    await load();
    setRegenerating(false);
  };

  if (loading) return null;
  if (!row && !isAdmin) return null;

  const generated = row?.generated_at ? new Date(row.generated_at) : null;
  const stats = row?.key_stats ?? [];

  return (
    <section className="border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">GEO Summary</h3>
        {isAdmin && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={cn(
              'px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors',
              'border border-[hsl(225,70%,35%)] text-[hsl(225,70%,35%)] hover:bg-[hsl(225,70%,35%)] hover:text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {regenerating ? 'Analyzing…' : row?.headline ? 'Regenerate' : 'Generate'}
          </button>
        )}
      </div>

      {errorMsg && <p className="text-sm text-destructive mb-4">{errorMsg}</p>}

      {row?.headline ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl font-bold text-foreground leading-tight">
            {row.headline}
          </h2>

          {stats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border-y border-border">
              {stats.slice(0, 3).map((s, i) => (
                <div
                  key={`${s.label}-${i}`}
                  className="p-4 text-center bg-muted/30 first:bg-muted/20 last:bg-muted/20"
                >
                  <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="text-xl font-semibold text-foreground mt-1.5 tabular-nums leading-tight">
                    {s.value}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                    {s.detail}
                  </div>
                </div>
              ))}
            </div>
          )}

          {row.narrative && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {row.narrative}
            </p>
          )}

          {Array.isArray(row.recommendations) && row.recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
                Recommendations
              </div>
              <div className="space-y-3">
                {row.recommendations.map((rec, i) => {
                  const accentColors = [
                    { border: 'hsl(225,70%,35%)', bg: 'hsla(225,70%,35%,0.08)' },
                    { border: 'hsl(150,60%,35%)', bg: 'hsla(150,60%,35%,0.08)' },
                    { border: 'hsl(35,80%,40%)', bg: 'hsla(35,80%,40%,0.08)' },
                  ];
                  const color = accentColors[i % accentColors.length];
                  return (
                    <div
                      key={i}
                      className="border-l-4 p-4 rounded-r-sm"
                      style={{ borderLeftColor: color.border, backgroundColor: color.bg }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-bold text-foreground min-w-[1.5em]">{i + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground leading-snug">{rec.title}</p>
                          <p className="text-sm text-foreground leading-snug mt-0.5">{rec.action}</p>
                          {rec.rationale && (
                            <p className="text-xs text-muted-foreground leading-snug mt-1.5">{rec.rationale}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {generated && !isNaN(generated.getTime()) && (
            <div className="text-[11px] text-muted-foreground pt-1">
              Generated {format(generated, 'MMM d, yyyy · h:mm a')}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No summary generated yet.</p>
      )}
    </section>
  );
};


// ---------- Product cards ----------
interface ProductCardCompetitor { name?: string | null; visibility?: number | null }
interface ProductCardMerchant { name?: string | null; share?: number | null; share_of_voice?: number | null }
interface ProductCardQuery { query?: string | null; query_text?: string | null }
interface ProductCardPress {
  outlet?: string | null;
  outlet_name?: string | null;
  headline?: string | null;
  title?: string | null;
  url?: string | null;
  date?: string | null;
  published_at?: string | null;
  reach?: number | null;
}
interface ProductCardRow extends ShoppingProductRow {
  first_seen: string | null;
  competitors: ProductCardCompetitor[] | null;
  press_count: number | null;
  recent_press: ProductCardPress[] | null;
  merchants: ProductCardMerchant[] | null;
  top_queries: (ProductCardQuery | string)[] | null;
  insight_headline: string | null;
  insight_text: string | null;
}

type ProductSort = 'newest' | 'visible';

const asPercent = (value: number | null | undefined, decimals = 0): string => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return `${(Math.abs(n) <= 1 ? n * 100 : n).toFixed(decimals)}%`;
};

const percentNumber = (value: number | null | undefined): number => {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  const n = Number(value);
  return Math.abs(n) <= 1 ? n * 100 : n;
};

const objectArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const categoryNames = (categories: ProductCardRow['categories']): string[] => objectArray<string | ProductCategory>(categories)
  .map((category) => typeof category === 'string' ? category : category?.name ?? '')
  .filter((name): name is string => Boolean(name));

const ProductCard = ({ product, accent, onOpen }: { product: ProductCardRow; accent: string; onOpen: () => void }) => {
  const categories = categoryNames(product.categories);
  const competitors = objectArray<ProductCardCompetitor>(product.competitors).slice(0, 5);
  const merchants = objectArray<ProductCardMerchant>(product.merchants).slice(0, 3);
  const queries = objectArray<ProductCardQuery | string>(product.top_queries).slice(0, 4);
  const press = objectArray<ProductCardPress>(product.recent_press).slice(0, 3);
  const firstSeen = product.first_seen ? new Date(product.first_seen) : null;
  const isNew = firstSeen != null && !Number.isNaN(firstSeen.getTime()) && Date.now() - firstSeen.getTime() <= 45 * 24 * 60 * 60 * 1000;
  const ranking = [
    { name: product.name, visibility: product.visibility, own: true },
    ...competitors.map((competitor) => ({ name: competitor.name || 'Unnamed competitor', visibility: competitor.visibility, own: false })),
  ];
  const maxVisibility = Math.max(...ranking.map((item) => percentNumber(item.visibility)), 1);
  const initial = (product.name?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(); }}
      className="group flex min-h-full cursor-pointer flex-col overflow-hidden border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_12px_30px_-18px_hsl(var(--foreground)/0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
                <span className="font-display text-lg font-semibold">{initial}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="font-display text-xl font-bold leading-tight text-foreground line-clamp-2">{product.name}</h3>
            {product.brand && <p className="mt-1 text-sm text-muted-foreground truncate">{product.brand}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categories.map((name) => (
                <span key={name} className="rounded-sm border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono-ui uppercase text-muted-foreground">
                  {name}
                </span>
              ))}
              {isNew && (
                <span className="rounded-sm border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-mono-ui font-semibold uppercase text-emerald-700">
                  New
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-border divide-x divide-y sm:divide-y-0 divide-border">
          {[
            { label: 'Visibility', value: asPercent(product.visibility, 1) },
            { label: 'Mentions', value: Number(product.mention_count ?? 0).toLocaleString() },
            { label: 'Avg position', value: product.avg_position == null ? '—' : `Top ${Number(product.avg_position).toFixed(1)}` },
            { label: 'AI #1 wins', value: Number(product.win_count ?? 0).toLocaleString() },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0 px-2 py-3 text-center bg-muted/15">
              <div className="font-display text-xl font-bold tabular-nums leading-none text-foreground">{stat.value}</div>
              <div className="mt-1.5 text-[9px] font-mono-ui uppercase text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {competitors.length > 0 && (
          <div>
            <div className="mb-2.5 text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Competitive SOV</div>
            <div className="space-y-2">
              {ranking.map((item, index) => {
                const value = percentNumber(item.visibility);
                return (
                  <div key={`${item.name}-${index}`} className="grid grid-cols-[minmax(90px,0.85fr)_1.4fr_42px] items-center gap-2">
                    <span className={cn('truncate text-[11px]', item.own ? 'font-bold' : 'text-muted-foreground')} style={item.own ? { color: accent } : undefined}>{item.name}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, value / maxVisibility * 100)}%`, backgroundColor: item.own ? accent : 'hsl(var(--muted-foreground) / 0.45)' }} />
                    </div>
                    <span className={cn('text-right text-[10px] font-mono tabular-nums', item.own ? 'font-bold' : 'text-muted-foreground')} style={item.own ? { color: accent } : undefined}>{asPercent(item.visibility)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {merchants.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Where AI sends shoppers</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {merchants.map((merchant, index) => (
                <div key={`${merchant.name}-${index}`} className="flex items-center justify-between gap-2 border border-border bg-muted/20 px-2.5 py-2">
                  <span className="truncate text-[11px] font-medium text-foreground">{merchant.name || 'Unknown merchant'}</span>
                  <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">{asPercent(merchant.share ?? merchant.share_of_voice)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {queries.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Top queries</div>
            <div className="flex flex-wrap gap-1.5">
              {queries.map((query, index) => {
                const label = typeof query === 'string' ? query : query.query ?? query.query_text;
                return label ? <span key={`${label}-${index}`} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground">{label}</span> : null;
              })}
            </div>
          </div>
        )}

        {Number(product.press_count ?? 0) > 0 && press.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
              Recent press
              <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono tabular-nums text-foreground">{Number(product.press_count).toLocaleString()}</span>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {press.map((item, index) => {
                const date = item.date ?? item.published_at;
                const dateLabel = date && !Number.isNaN(new Date(date).getTime()) ? format(new Date(date), 'MMM d') : null;
                return (
                  <div key={`${item.url}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-foreground truncate">{item.outlet ?? item.outlet_name ?? 'Press'}</div>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-foreground hover:underline">
                          <span className="truncate">{item.headline ?? item.title ?? 'View coverage'}</span><ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <div className="mt-0.5 truncate text-xs text-foreground">{item.headline ?? item.title ?? 'Untitled coverage'}</div>
                      )}
                    </div>
                    <div className="text-right text-[10px] font-mono text-muted-foreground">
                      {dateLabel && <div>{dateLabel}</div>}
                      {item.reach != null && <div className="mt-0.5">{formatReach(item.reach)} reach</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {product.insight_text && (
        <div className="mt-auto border-l-4 border-emerald-600 bg-emerald-600/10 px-5 py-4">
          {product.insight_headline && <div className="text-sm font-bold text-foreground">{product.insight_headline}</div>}
          <p className={cn('text-xs leading-relaxed text-muted-foreground', product.insight_headline && 'mt-1')}>{product.insight_text}</p>
        </div>
      )}
    </article>
  );
};

const ProductCardsSection = ({ clientId, accent }: { clientId: string | null; accent: string }) => {
  const { isAdmin } = useAdmin();
  const [rows, setRows] = useState<ProductCardRow[]>([]);
  const [sort, setSort] = useState<ProductSort>('newest');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProductCardRow | null>(null);

  const load = async () => {
    if (!clientId) { setRows([]); setLoading(false); return; }
    const { data, error } = await supabase.rpc('peec_product_cards', { p_client_id: clientId, p_limit: 12 });
    if (error) {
      console.error('[ProductCards] load failed', error);
      setRows([]);
      setErrorMsg(error.message || 'Unable to load products.');
    } else {
      setRows(Array.isArray(data) ? data as ProductCardRow[] : []);
      setErrorMsg(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const dateA = a.first_seen ? new Date(a.first_seen).getTime() : Number.NaN;
    const dateB = b.first_seen ? new Date(b.first_seen).getTime() : Number.NaN;
    if (sort === 'visible') {
      return Number(b.visibility ?? 0) - Number(a.visibility ?? 0) || (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA);
    }
    if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateB - dateA || Number(b.visibility ?? 0) - Number(a.visibility ?? 0);
    if (!Number.isNaN(dateA)) return -1;
    if (!Number.isNaN(dateB)) return 1;
    return Number(b.visibility ?? 0) - Number(a.visibility ?? 0);
  }), [rows, sort]);

  const handleGenerate = async () => {
    if (!clientId) return;
    setGenerating(true);
    setErrorMsg(null);
    const { data, error } = await supabase.functions.invoke('peec-product-card-insights', { body: { client_id: clientId, limit: 12 } });
    const responseError = data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error ?? '') : '';
    if (error || responseError) setErrorMsg(responseError || error?.message || 'Unable to generate insights.');
    else await load();
    setGenerating(false);
  };

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Product Intelligence</div>
          <h2 className="mt-1 font-display text-2xl font-bold text-foreground">Products surfaced by AI</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-border bg-background p-0.5" aria-label="Sort products">
            {([['newest', 'Newest'], ['visible', 'Most visible']] as [ProductSort, string][]).map(([value, label]) => (
              <Button key={value} type="button" variant="ghost" size="sm" onClick={() => setSort(value)} className={cn('h-7 rounded-sm px-3 text-[10px] font-mono-ui uppercase', sort === value && 'bg-foreground text-background hover:bg-foreground hover:text-background')}>
                {label}
              </Button>
            ))}
          </div>
          {isAdmin && (
            <Button type="button" variant="outline" size="sm" onClick={handleGenerate} disabled={generating || !clientId} className="h-8 rounded-sm text-[10px] font-mono-ui uppercase">
              <RefreshCw className={cn('h-3.5 w-3.5', generating && 'animate-spin')} />
              {generating ? 'Generating…' : 'Generate insights'}
            </Button>
          )}
        </div>
      </div>

      {errorMsg && <div className="mb-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{errorMsg}</div>}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[540px] w-full" />)}
        </div>
      ) : sortedRows.length > 0 ? (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          {sortedRows.map((product) => <ProductCard key={product.product_id} product={product} accent={accent} onOpen={() => setSelected(product)} />)}
        </div>
      ) : !errorMsg ? (
        <div className="border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">No product intelligence is available yet.</div>
      ) : null}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-screen sm:max-w-3xl overflow-y-auto">
          {selected && <ProductDetailSheetBody product={selected} clientId={clientId} accent={accent} />}
        </SheetContent>
      </Sheet>
    </section>
  );
};

const ProductIntelligenceTab = () => {
  const { activeClientId } = useWeek();
  const { clientColor } = useAdmin();
  const accent = clientColor || '#1B2B8A';

  return (
    <div className="px-6 py-8 space-y-6 bg-background">
      <ProductCardsSection clientId={activeClientId} accent={accent} />
      <GeoSummaryCard clientId={activeClientId} />
    </div>
  );
};

export default ProductIntelligenceTab;
