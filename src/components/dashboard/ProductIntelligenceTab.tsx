import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

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
  categories: string[] | null;
  captured_date: string | null;
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

const rankTier = (idx: number, expanded: boolean): { label: string; tone: 'top' | 'high' | 'growing' | 'active' } => {
  if (idx === 0) return { label: 'Most Visible', tone: 'top' };
  if (idx <= 2) return { label: 'High Visibility', tone: 'high' };
  if (idx <= 7) return { label: 'Growing Presence', tone: 'growing' };
  return { label: 'Active', tone: 'active' };
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

          {row.action && (
            <div
              className="border-l-4 p-4 rounded-r-sm"
              style={{ borderLeftColor: 'hsl(var(--accent))', backgroundColor: 'hsl(var(--accent)/0.08)' }}
            >
              <p className="text-sm text-foreground leading-snug">
                <span className="font-bold text-[11px] tracking-[0.08em] uppercase mr-1">NEXT STEP:</span>
                {row.action}
              </p>
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


// ---------- Leaderboard ----------
interface CategoryOption { category_id: string; name: string }

const AiShoppingVisibilitySection = ({ clientId, accent }: { clientId: string | null; accent: string }) => {
  const [rows, setRows] = useState<ShoppingProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<ShoppingProductRow | null>(null);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setActiveCategory('all');
    (async () => {
      try {
        const [prodRes, cfgRes] = await Promise.all([
          supabase.rpc('peec_products_latest', { p_client_id: clientId, p_limit: 24 }),
          supabase.from('peec_client_config').select('project_id').eq('client_id', clientId).maybeSingle(),
        ]);
        if (prodRes.error) throw prodRes.error;
        const list: ShoppingProductRow[] = Array.isArray(prodRes.data) ? prodRes.data : [];
        list.sort((a, b) => (b.visibility ?? 0) - (a.visibility ?? 0));
        if (!cancelled) setRows(list);

        const projectId = (cfgRes.data as { project_id?: string } | null)?.project_id;
        if (projectId) {
          const { data: cats } = await supabase
            .from('peec_product_categories')
            .select('category_id, name')
            .eq('project_id', projectId);
          if (!cancelled) setCategories((cats as CategoryOption[]) ?? []);
        } else if (!cancelled) {
          setCategories([]);
        }
      } catch (e) {
        console.error('[AiShoppingVisibility] load failed', e);
        if (!cancelled) { setRows([]); setCategories([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  // Only categories that actually appear in the current product set.
  const presentCategories = useMemo(() => {
    const used = new Set<string>();
    rows.forEach((r) => (r.categories ?? []).forEach((c) => c && used.add(String(c))));
    const seenNames = new Set<string>();
    return categories
      .filter((c) => c.category_id && c.name && used.has(String(c.category_id)))
      .filter((c) => {
        if (seenNames.has(c.name)) return false;
        seenNames.add(c.name);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, categories]);

  const filteredRows = useMemo(() => {
    if (activeCategory === 'all') return rows;
    return rows.filter((r) => (r.categories ?? []).some((c) => String(c) === activeCategory));
  }, [rows, activeCategory]);

  useEffect(() => { setExpanded(false); }, [activeCategory]);

  if (loading) {
    return (
      <section className="border border-border bg-card p-6">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">AI Shopping Visibility</h3>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </section>
    );
  }

  if (!rows.length) return null;

  const captured = rows.find(r => r.captured_date)?.captured_date;
  const capturedLabel = captured && !isNaN(new Date(captured).getTime())
    ? new Date(captured).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const visible = expanded ? filteredRows : filteredRows.slice(0, 8);
  const hasMore = filteredRows.length > 8;

  return (
    <section className="border border-border bg-card">
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">AI Shopping Visibility</div>
          <div className="text-sm text-foreground mt-1">Which of your products AI recommends most</div>
        </div>
        {capturedLabel && (
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            As of {capturedLabel}
          </div>
        )}
      </div>

      {presentCategories.length > 0 && (
        <div className="px-6 py-3 border-b border-border">
          <div className="flex flex-wrap gap-1.5">
            {[{ category_id: 'all', name: 'All' }, ...presentCategories].map((c) => {
              const active = activeCategory === c.category_id;
              return (
                <button
                  key={c.category_id}
                  type="button"
                  onClick={() => setActiveCategory(c.category_id)}
                  className={cn(
                    'px-3 py-1 rounded-full border text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors',
                    active ? 'text-white border-transparent' : 'text-muted-foreground border-border hover:text-foreground'
                  )}
                  style={active ? { backgroundColor: accent } : undefined}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ol className="divide-y divide-border">
        {visible.map((p, idx) => {
          const pct = Math.round((p.visibility ?? 0) * 100);
          const isTop = idx === 0;
          const initial = (p.name?.trim()?.[0] ?? '?').toUpperCase();
          const tier = rankTier(idx, expanded);
          const tierClass =
            tier.tone === 'top'
              ? 'text-foreground border-transparent'
              : 'text-muted-foreground border-border bg-muted/40';
          const tierStyle =
            tier.tone === 'top'
              ? { backgroundColor: `${accent}1A`, color: accent }
              : undefined;
          return (
            <li key={p.product_id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className={`w-full grid grid-cols-[120px_44px_1fr_auto] gap-4 items-center px-6 py-3 text-left hover:bg-muted/40 transition-colors ${isTop ? 'bg-muted/30' : ''}`}
              >
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-sm border text-[10px] font-mono font-semibold uppercase tracking-[0.12em] ${tierClass}`}
                    style={tierStyle}
                  >
                    {tier.label}
                  </span>
                </div>
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted" loading="lazy" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <div className={`truncate text-sm ${isTop ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                    {p.name}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 max-w-[260px] rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-muted-foreground w-10 text-right">
                      {pct}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <span>{positionTier(p.avg_position)}</span>
                  <span>{(p.mention_count ?? 0).toLocaleString()} mentions</span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <div className="px-6 py-3 border-t border-border">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <>Show less <ChevronUp className="h-3 w-3" /></> : <>Show all {filteredRows.length} products <ChevronDown className="h-3 w-3" /></>}
          </button>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
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
      <AiShoppingVisibilitySection clientId={activeClientId} accent={accent} />
      <GeoSummaryCard clientId={activeClientId} />
    </div>
  );
};

export default ProductIntelligenceTab;
