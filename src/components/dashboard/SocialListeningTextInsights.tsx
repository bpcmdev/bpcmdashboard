/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { formatCount } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------------------------------------
 * Social Listening — "most popular emojis" and "context of the discussion" (word cloud).
 * Counted by n8n from the text of every mention Brand24 returns text for, one count per mention.
 * RPC: listening_text_insights
 * ---------------------------------------------------------------------------------------------- */

interface Tok { t: string; n: number }
interface TextInsights { days_covered: number; since: string | null; words: Tok[]; emojis: Tok[] }

const PALETTE = [
  'hsl(225 70% 38%)',
  'hsl(268 45% 44%)',
  'hsl(174 62% 28%)',
  'hsl(16 75% 42%)',
  'hsl(330 55% 42%)',
  'hsl(42 75% 34%)',
];

// Brand24's API strips most emojis from mention text (only symbols such as ✨ and ❤ survive), so an emoji chart
// built from it would mislead. Flip to true if Brand24 starts returning the full text.
const SHOW_EMOJIS = false;

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Maps a count to a size between lo and hi; the exponent keeps a few giant words from flattening the rest. */
function sizeFor(n: number, min: number, max: number, lo: number, hi: number, exp = 0.55): number {
  if (max <= min) return (lo + hi) / 2;
  return lo + (hi - lo) * Math.pow((n - min) / (max - min), exp);
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{children}</h3>
      {right}
    </div>
  );
}

const SocialListeningTextInsights = () => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const [data, setData] = useState<TextInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      const { data: d, error: err } = await supabase.rpc('listening_text_insights' as any, {
        p_client_id: activeClientId, ...range, p_words: 70, p_emojis: 40,
      });
      if (cancelled) return;
      if (err) {
        console.error('listening_text_insights failed:', err);
        setError(true);
        setLoading(false);
        return;
      }
      setData((d ?? null) as TextInsights | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, refreshKey]);

  const words = useMemo(() => {
    const list = arr<Tok>(data?.words).filter(w => num(w.n) > 0);
    if (!list.length) return { items: [] as (Tok & { size: number; color: string; weight: number; opacity: number })[] };
    const counts = list.map(w => num(w.n));
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const items = list
      .map(w => {
        const size = sizeFor(num(w.n), min, max, 12, 46);
        return {
          ...w,
          size,
          color: PALETTE[hash(w.t) % PALETTE.length],
          weight: size > 28 ? 700 : size > 18 ? 600 : 500,
          opacity: 0.55 + 0.45 * ((size - 12) / 34),
        };
      })
      // stable pseudo-shuffle so the cloud mixes big and small words instead of reading as a ranked list
      .sort((a, b) => hash(a.t) - hash(b.t));
    return { items };
  }, [data]);

  const emojis = useMemo(() => {
    const list = arr<Tok>(data?.emojis).filter(e => num(e.n) > 0);
    if (!list.length) return [] as (Tok & { size: number })[];
    const counts = list.map(e => num(e.n));
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    return list
      .map(e => ({ ...e, size: sizeFor(num(e.n), min, max, 20, 58, 0.6) }))
      .sort((a, b) => hash(a.t) - hash(b.t));
  }, [data]);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">Emoji and word analysis could not be loaded. Refresh the page to try again.</p>;
  const showEmojis = SHOW_EMOJIS && emojis.length > 0;
  if (!words.items.length && !showEmojis) return null;

  return (
    <div className={showEmojis ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
      {showEmojis && (
        <div className="section-card border p-5">
          <SectionTitle>Most popular emojis</SectionTitle>
          {emojis.length ? (
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 min-h-[200px]" aria-label="Most popular emojis, larger means more mentions">
              {emojis.map(e => (
                <li key={e.t} title={`${e.t} appears in ${formatCount(num(e.n))} mentions`} style={{ fontSize: `${e.size}px`, lineHeight: 1.1 }}>
                  <span aria-label={`${formatCount(num(e.n))} mentions`}>{e.t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No emojis in this period.</p>
          )}
        </div>
      )}

      <div className="section-card border p-5">
        <SectionTitle>Context of the discussion</SectionTitle>
        {words.items.length ? (
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 min-h-[200px]" aria-label="Most common words in mentions, larger means more mentions">
            {words.items.map(w => (
              <li
                key={w.t}
                title={`“${w.t}” appears in ${formatCount(num(w.n))} mentions`}
                style={{ fontSize: `${w.size}px`, color: w.color, fontWeight: w.weight, opacity: w.opacity, lineHeight: 1.15 }}
              >
                {w.t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">No text to analyse in this period.</p>
        )}
      </div>

      <p className={showEmojis ? 'text-[11px] text-muted-foreground lg:col-span-2 -mt-1' : 'text-[11px] text-muted-foreground -mt-1'}>
        Counts show how many mentions contain each word{showEmojis ? ' or emoji' : ''}. Instagram, Facebook and X posts return no text through the listening tool, so they aren't included.
        {data?.since ? ` Text analysis starts ${new Date(data.since + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.` : ''}
      </p>
    </div>
  );
};

export default SocialListeningTextInsights;