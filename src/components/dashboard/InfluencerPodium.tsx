/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { ArrowRight, Crown } from 'lucide-react';
import { Chips, fmt, fmtMoney, num, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Influencer Intelligence: the top three creators.
 * Medal-edged cards with each creator's share of total EMV, what they earn per post, and how far their
 * reach goes past their own following. Clicking a card opens that creator's profile drawer.
 * ---------------------------------------------------------------------------------------------- */

interface Creator {
  name: string;
  followers: number;
  posts: number;
  reach: number;
  emv: number;
  avgEng: number;
}

interface Props {
  accent: string;
  creators: Creator[];
  totals: { emv: number; reach: number; posts: number };
  onOpen: (name: string) => void;
}

const MEDALS = [
  { label: 'Gold', color: 'hsl(42 60% 48%)', glow: 'hsl(42 70% 55%)', face: 'radial-gradient(circle at 30% 30%, #F4DC98 0%, #C9A961 60%, #8A6A2E 100%)' },
  { label: 'Silver', color: 'hsl(215 14% 58%)', glow: 'hsl(215 20% 70%)', face: 'radial-gradient(circle at 30% 30%, #F1F3F6 0%, #AAB2BD 60%, #6C7480 100%)' },
  { label: 'Bronze', color: 'hsl(25 55% 46%)', glow: 'hsl(25 65% 55%)', face: 'radial-gradient(circle at 30% 30%, #F0C9A3 0%, #C07A3E 60%, #7A4A22 100%)' },
];

const tierOf = (followers: number): { label: string; bg: string; fg: string } => {
  if (followers >= 1_000_000) return { label: 'Mega', bg: '#000000', fg: '#FFFFFF' };
  if (followers >= 100_000) return { label: 'Macro', bg: '#1B2B8A', fg: '#FFFFFF' };
  if (followers >= 50_000) return { label: 'Mid', bg: '#C9A961', fg: '#000000' };
  return { label: 'Micro', bg: 'rgba(0,0,0,0.1)', fg: 'inherit' };
};

const InfluencerPodium = ({ accent, creators, totals, onOpen }: Props) => {
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const top = creators.slice(0, 3);
  if (!top.length) return null;

  const emvTotal = num(totals.emv);
  const reachTotal = num(totals.reach);
  const topEmv = top.reduce((s, c) => s + num(c.emv), 0);
  const topReach = top.reduce((s, c) => s + num(c.reach), 0);

  const insights: string[] = [];
  if (emvTotal > 0 && topEmv > 0) insights.push(`These three creators deliver ${Math.round((topEmv / emvTotal) * 100)}% of all EMV.`);
  if (reachTotal > 0 && topReach > 0) insights.push(`They account for ${Math.round((topReach / reachTotal) * 100)}% of all reach.`);
  const perPost = top.filter(c => c.posts > 0).sort((a, b) => b.emv / b.posts - a.emv / a.posts)[0];
  if (perPost) insights.push(`Best value per post: ${perPost.name}, ${fmtMoney(perPost.emv / perPost.posts)} each.`);
  const amp = top.filter(c => c.followers > 0 && c.reach > 0).sort((a, b) => b.reach / b.followers - a.reach / a.followers)[0];
  if (amp) insights.push(`${amp.name} reaches ${Math.round(amp.reach / amp.followers)}x their own following.`);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top.map((c, i) => {
          const medal = MEDALS[i];
          const t = tierOf(c.followers);
          const share = emvTotal > 0 ? (c.emv / emvTotal) * 100 : 0;
          const evp = c.posts > 0 ? c.emv / c.posts : 0;
          const ampX = c.followers > 0 && c.reach > 0 ? c.reach / c.followers : 0;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onOpen(c.name)}
              aria-label={`Open ${c.name}, ranked ${i + 1}`}
              className="group relative w-full text-left border border-black/10 bg-card p-5 overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                borderTop: `3px solid ${medal.color}`,
                background: `linear-gradient(165deg, ${withAlpha(medal.color, i === 0 ? 0.13 : 0.08)}, transparent 62%)`,
                ['--tw-ring-color' as any]: medal.color,
              }}
            >
              <span
                aria-hidden
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle, ${withAlpha(medal.glow, 0.28)}, transparent 70%)` }}
              />

              <div className="relative flex items-center gap-3">
                <div
                  className="relative w-12 h-12 rounded-full flex items-center justify-center font-display text-xl font-bold text-black shrink-0 shadow-sm"
                  style={{ background: medal.face }}
                >
                  {i + 1}
                  {i === 0 && <Crown className="absolute -top-2.5 -right-1.5 w-4 h-4" style={{ color: medal.color }} aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono-ui text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5" style={{ background: t.bg, color: t.fg }}>{t.label}</span>
                    <span className="text-[11px] text-muted-foreground">{fmt(c.followers)} followers</span>
                  </div>
                </div>
              </div>

              <div className="relative grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-black/[0.07]">
                <div>
                  <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">EMV</p>
                  <p className="font-display text-xl font-bold tabular-nums" style={{ color: accent }}>{fmtMoney(c.emv)}</p>
                </div>
                <div>
                  <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">Reach</p>
                  <p className="font-display text-xl font-bold tabular-nums">{fmt(c.reach)}</p>
                </div>
                <div>
                  <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">Posts</p>
                  <p className="font-display text-xl font-bold tabular-nums">{fmt(c.posts)}</p>
                </div>
              </div>

              {share > 0 && (
                <div className="relative mt-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground">Share of total EMV</span>
                    <span className="font-display text-sm font-bold tabular-nums" style={{ color: medal.color }}>{share < 1 ? share.toFixed(1) : Math.round(share)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/[0.06] overflow-hidden" aria-hidden>
                    <div
                      className="h-full"
                      style={{
                        width: ready || reduced ? `${Math.min(100, share)}%` : '0%',
                        background: `linear-gradient(90deg, ${withAlpha(medal.color, 0.7)}, ${medal.color})`,
                        transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22,1,0.36,1)',
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="relative grid grid-cols-3 gap-2 mt-4 text-[11px]">
                <div>
                  <p className="text-muted-foreground">EMV per post</p>
                  <p className="font-semibold tabular-nums">{evp ? fmtMoney(evp) : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reach vs following</p>
                  <p className="font-semibold tabular-nums">{ampX ? `${ampX >= 10 ? Math.round(ampX) : ampX.toFixed(1)}x` : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg engagement</p>
                  <p className="font-semibold tabular-nums">{c.avgEng ? `${c.avgEng.toFixed(2)}%` : '-'}</p>
                </div>
              </div>

              <p className="relative flex items-center gap-1 mt-4 font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground group-hover:text-foreground transition-colors">
                Open creator profile <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </p>
            </button>
          );
        })}
      </div>
      <Chips items={insights} color={accent} />
    </div>
  );
};

export default InfluencerPodium;
