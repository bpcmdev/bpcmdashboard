import { useEffect, useMemo, useState } from 'react';
import { Plus, Info, Loader2 } from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RankingEntry {
  name: string;
  ranking: number | null;
  competitors: { name: string; domain: string | null }[] | null;
}

interface AttributeEntry {
  name: string;
  score: number;
  members: string[] | null;
}

interface PerceptionOverview {
  captured_date: string | null;
  own_brand: string | null;
  most_associated: string | null;
  best_attribute: string | null;
  best_ranking: number | null;
  gap_attribute: string | null;
  gap_own_position: number | null;
  gap_competitive_rank: number | null;
  strongest_competitor: string | null;
  has_radar: boolean;
  attributes: AttributeEntry[] | null;
  rankings: RankingEntry[] | null;
}

interface RadarRow {
  attribute: string;
  brand: string;
  score: number;
  is_own: boolean;
}

interface BrandOption {
  brand: string;
  total_score: number;
  is_own: boolean;
}

const MUTED_GREYS = ['#6B7280', '#9CA3AF', '#C4C4C4'];

const toArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const BrandPerceptionSection = ({
  clientId,
  clientName,
  accent = '#1B2B8A',
}: {
  clientId: string;
  clientName?: string | null;
  accent?: string;
}) => {
  const [overview, setOverview] = useState<PerceptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [radarRows, setRadarRows] = useState<RadarRow[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [showAllAttrs, setShowAllAttrs] = useState(false);
  const [selectedAttr, setSelectedAttr] = useState<AttributeEntry | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const label = clientName || 'your brand';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOverview(null);
    setSelectedBrands(null);
    setShowAllAttrs(false);
    (async () => {
      const { data } = await supabase.rpc('peec_perception_overview', { p_client_id: clientId });
      if (cancelled) return;
      const row = Array.isArray(data) ? (data[0] ?? null) : data;
      setOverview((row as PerceptionOverview) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    if (!overview?.has_radar) { setRadarRows([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('peec_perception_radar', {
        p_client_id: clientId,
        p_brands: selectedBrands,
        p_attr_limit: 8,
      });
      if (!cancelled) setRadarRows(toArr<RadarRow>(data));
    })();
    return () => { cancelled = true; };
  }, [clientId, selectedBrands, overview?.has_radar]);

  useEffect(() => {
    if (!overview?.has_radar) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('peec_perception_brand_options', { p_client_id: clientId });
      if (!cancelled) setBrandOptions(toArr<BrandOption>(data));
    })();
    return () => { cancelled = true; };
  }, [clientId, overview?.has_radar]);

  const attributes = useMemo(() => toArr<AttributeEntry>(overview?.attributes), [overview]);
  const rankings = useMemo(() => toArr<RankingEntry>(overview?.rankings), [overview]);
  const maxScore = useMemo(
    () => attributes.reduce((m, a) => Math.max(m, Number(a.score) || 0), 0) || 1,
    [attributes],
  );
  const visibleAttrs = showAllAttrs ? attributes : attributes.slice(0, 8);

  // ---- radar pivot ----
  const radarBrands = useMemo(() => {
    const seen = new Map<string, boolean>();
    radarRows.forEach(r => { if (!seen.has(r.brand)) seen.set(r.brand, !!r.is_own); });
    const arr = Array.from(seen.entries()).map(([brand, is_own]) => ({ brand, is_own }));
    arr.sort((a, b) => Number(b.is_own) - Number(a.is_own));
    return arr;
  }, [radarRows]);

  const brandColor = (brand: string) => {
    const idx = radarBrands.findIndex(b => b.brand === brand);
    if (radarBrands[idx]?.is_own) return accent;
    const competitorIdx = radarBrands.slice(0, idx).filter(b => !b.is_own).length;
    return MUTED_GREYS[competitorIdx % MUTED_GREYS.length];
  };

  const radarData = useMemo(() => {
    const byAttr = new Map<string, RadarRow[]>();
    radarRows.forEach(r => {
      const list = byAttr.get(r.attribute) ?? [];
      list.push(r);
      byAttr.set(r.attribute, list);
    });
    return Array.from(byAttr.entries()).map(([attribute, rows]) => {
      const max = rows.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0) || 1;
      const obj: Record<string, string | number> = { attribute };
      rows.forEach(r => {
        obj[r.brand] = Math.round(((Number(r.score) || 0) / max) * 100);
        obj[`__raw_${r.brand}`] = Number(r.score) || 0;
      });
      return obj;
    });
  }, [radarRows]);

  const activeBrands = selectedBrands ?? radarBrands.map(b => b.brand);
  const atCap = activeBrands.length >= 4;

  const toggleBrand = (brand: string) => {
    const current = activeBrands;
    if (current.includes(brand)) {
      if (current.length <= 1) return;
      setSelectedBrands(current.filter(b => b !== brand));
    } else {
      if (current.length >= 4) return;
      setSelectedBrands([...current, brand]);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border/60 p-6 flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!overview) return null;

  const rankingFor = (name: string) => rankings.find(r => r.name === name) ?? null;

  const StatCard = ({
    eyebrow, value, suffix, tip,
  }: { eyebrow: string; value: string; suffix?: string | null; tip?: string }) => (
    <div className="bg-card border border-border/60 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">{eyebrow}</p>
        {tip && (
          <TooltipProvider>
            <UiTooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={`About ${eyebrow}`}>
                  <Info className="h-3 w-3 text-muted-foreground/70" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px] text-[11px] leading-relaxed">{tip}</TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="font-display text-lg font-semibold leading-snug">
        {value}
        {suffix && <span className="ml-1.5 font-mono-ui text-[11px] font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono-ui text-[10px] tracking-[0.22em] uppercase text-muted-foreground mb-1">
            Brand Perception
          </p>
          <h3 className="font-display text-2xl font-bold tracking-tight">How AI describes {label}</h3>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-xl">
            What AI associates {label} with, and where it holds ground against competitors.
          </p>
        </div>
        {overview.captured_date && (
          <p className="font-mono-ui text-[10px] tracking-[0.12em] uppercase text-muted-foreground shrink-0 pt-1">
            Updated {overview.captured_date}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard eyebrow="Most associated" value={overview.most_associated || '—'} />
        <StatCard
          eyebrow="Best vs competitors"
          value={overview.best_attribute || '—'}
          suffix={overview.best_ranking != null ? `#${overview.best_ranking}` : null}
          tip="Rank is the brand's position among all brands AI scores for that attribute. Lower is better — #1 means no brand is named ahead of you."
        />
        <StatCard
          eyebrow="Biggest gap"
          value={overview.gap_attribute || 'None — leads its field'}
          suffix={
            overview.gap_attribute && overview.gap_own_position != null && overview.gap_competitive_rank != null
              ? `#${overview.gap_own_position} → #${overview.gap_competitive_rank}`
              : null
          }
          tip="The largest mismatch between a strong association for your brand and a weaker actual rank against competitors on that attribute."
        />
        <StatCard eyebrow="Strongest competitor" value={overview.strongest_competitor || 'Not yet available'} />
      </div>

      {/* Body */}
      <div className={overview.has_radar ? 'grid grid-cols-1 lg:grid-cols-2 gap-5' : ''}>
        {/* Left: attributes */}
        <div className="bg-card border border-border/60 p-5">
          <h4 className="font-display text-lg font-semibold tracking-tight">How AI describes {label}</h4>
          <p className="text-[12px] text-muted-foreground mt-0.5 mb-4">
            Top attributes when AI is asked about {label}.
          </p>
          {visibleAttrs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground py-6 text-center">No attributes captured yet.</p>
          ) : (
            <div className="space-y-2.5">
              {visibleAttrs.map(attr => {
                const pct = Math.max(4, Math.round(((Number(attr.score) || 0) / maxScore) * 100));
                return (
                  <button
                    key={attr.name}
                    type="button"
                    onClick={() => setSelectedAttr(attr)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className="text-[12.5px] font-medium group-hover:underline">{attr.name}</span>
                      <span className="font-mono-ui text-[11px] text-muted-foreground">{attr.score}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/60">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {attributes.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllAttrs(v => !v)}
              className="mt-4 font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllAttrs ? 'Show top 8' : `Show all ${attributes.length} attributes`}
            </button>
          )}
        </div>

        {/* Right: radar */}
        {overview.has_radar && (
          <div className="bg-card border border-border/60 p-5">
            <h4 className="font-display text-lg font-semibold tracking-tight">Brand shape</h4>
            <p className="text-[12px] text-muted-foreground mt-0.5 mb-2">
              The same prominence, one axis per attribute.
            </p>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="hsl(0 0% 0% / 0.12)" />
                  <PolarAngleAxis dataKey="attribute" tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string, entry: { payload?: Record<string, number> }) => {
                      const raw = entry?.payload?.[`__raw_${name}`];
                      return [raw != null ? `${raw} (${value}%)` : `${value}%`, name];
                    }}
                    contentStyle={{ fontSize: 11, border: '1px solid hsl(0 0% 0% / 0.15)', borderRadius: 2 }}
                  />
                  <Legend content={() => null} />
                  {activeBrands.map(brand => {
                    const isOwn = radarBrands.find(b => b.brand === brand)?.is_own;
                    const color = brandColor(brand);
                    return (
                      <Radar
                        key={brand}
                        name={brand}
                        dataKey={brand}
                        stroke={color}
                        strokeWidth={isOwn ? 2.5 : 1.25}
                        fill={color}
                        fillOpacity={isOwn ? 0.28 : 0.08}
                      />
                    );
                  })}
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend + picker */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {activeBrands.map(brand => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => toggleBrand(brand)}
                  className="inline-flex items-center gap-1.5 border border-border/60 px-2 py-1 text-[11px] hover:bg-muted/40 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColor(brand) }} />
                  {brand}
                </button>
              ))}
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={atCap}
                    className="inline-flex items-center gap-1 border border-dashed border-border/70 px-2 py-1 font-mono-ui text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2 max-h-72 overflow-y-auto">
                  <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground px-1 pb-2">
                    Compare brands
                  </p>
                  {brandOptions.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-1 py-2">No brands available.</p>
                  )}
                  {brandOptions.map(opt => {
                    const active = activeBrands.includes(opt.brand);
                    return (
                      <button
                        key={opt.brand}
                        type="button"
                        onClick={() => toggleBrand(opt.brand)}
                        disabled={!active && atCap}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[12px] hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                      >
                        <span className={active ? 'font-medium' : ''}>
                          {opt.brand}{opt.is_own ? ' (you)' : ''}
                        </span>
                        <span className="font-mono-ui text-[10px] text-muted-foreground">
                          {active ? 'On' : opt.total_score}
                        </span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
              {atCap && (
                <span className="text-[10px] text-muted-foreground">Up to 4 brands for readability</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Attribute detail sheet */}
      <Sheet open={!!selectedAttr} onOpenChange={(o) => { if (!o) setSelectedAttr(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedAttr && (() => {
            const rank = rankingFor(selectedAttr.name);
            const competitors = toArr<{ name: string; domain: string | null }>(rank?.competitors);
            const members = toArr<string>(selectedAttr.members);
            return (
              <div className="space-y-6">
                <SheetHeader className="space-y-2 text-left">
                  <p className="font-mono-ui text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                    Attribute
                  </p>
                  <SheetTitle className="font-display text-2xl font-bold tracking-tight">
                    {selectedAttr.name}
                  </SheetTitle>
                  <p className="font-mono-ui text-[11px] text-muted-foreground">
                    Score {selectedAttr.score}
                    {rank?.ranking != null && ` · Rank #${rank.ranking}`}
                  </p>
                </SheetHeader>

                <div>
                  <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                    Phrases AI actually used
                  </p>
                  {members.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">No phrases captured.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m, i) => (
                        <span
                          key={`${m}-${i}`}
                          className="text-[11px] px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${accent}12`, color: accent, border: `1px solid ${accent}33` }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                    {rank?.ranking != null && rank.ranking > 1
                      ? 'Brands AI names ahead of you'
                      : 'Brands AI names alongside you'}
                  </p>
                  {competitors.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">No competing brands named.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {competitors.map((c, i) => (
                        <span
                          key={`${c.name}-${i}`}
                          className="text-[11px] px-2 py-1 rounded-full border border-border/60 bg-muted/40"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BrandPerceptionSection;
