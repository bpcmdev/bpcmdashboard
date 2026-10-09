/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from 'react';
import { ExternalLink, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Chips, CountUp, DetailShell, MetricCard, SubLabel, Tile, arr, fmt, fmtPct, hsl, insertAfterIndex, num,
  useColumns, useEscape, usePrefersReducedMotion,
} from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Influencer Intelligence: engagement breakdown (likes, comments, views, shares).
 * Each card shows the total, its share of engagement and a per-post average. Selecting one (or its
 * segment in the mix bar) opens the ratios that matter and the strongest posts for that action.
 * ---------------------------------------------------------------------------------------------- */

type Key = 'likes' | 'comments' | 'views' | 'shares';

interface PostLike {
  id: string;
  author_name: string | null;
  campaign_name: string | null;
  network: string | null;
  post_link: string | null;
  posted_at: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  shares: number | null;
}

interface Props {
  accent: string;
  totals: { likes: number; comments: number; views: number; shares: number; engagements: number };
  posts: number;
  topPosts: PostLike[];
}

interface Def {
  key: Key;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

const DEFS: Def[] = [
  { key: 'likes', label: 'Likes', icon: Heart,
    blurb: 'The quickest signal that content landed. Some Instagram posts hide their like counts, so this can undercount.' },
  { key: 'comments', label: 'Comments', icon: MessageCircle,
    blurb: 'People talking back. A comment takes more effort than a like, so it is a stronger sign of real interest.' },
  { key: 'views', label: 'Views', icon: Eye,
    blurb: 'How often the content was actually watched or seen. Reach estimates are tracked separately.' },
  { key: 'shares', label: 'Shares', icon: Share2,
    blurb: 'People passing content on to their own audience. Shares are the rarest action and the most valuable.' },
];

const colorFor = (k: Key, accent: string): string =>
  k === 'likes' ? hsl(345, 78, 50) : k === 'comments' ? accent : k === 'views' ? hsl(190, 72, 34) : 'hsl(40 72% 42%)';

const InfluencerEngagementCards = ({ accent, totals, posts, topPosts }: Props) => {
  const reduced = usePrefersReducedMotion();
  const cols = useColumns({ base: 2, md: 4 });
  const [selected, setSelected] = useState<Key | null>(null);
  const [hoverSeg, setHoverSeg] = useState<Key | null>(null);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);

  const selectedIdx = selected ? DEFS.findIndex(d => d.key === selected) : -1;
  const after = insertAfterIndex(selectedIdx, cols, DEFS.length);

  const eng = num(totals.engagements);
  const share = (k: Key) => (k === 'views' || !eng ? null : (num(totals[k]) / eng) * 100);

  const mix = (['likes', 'comments', 'shares'] as Key[]).map(k => ({
    key: k,
    label: DEFS.find(d => d.key === k)!.label,
    v: num(totals[k]),
    pct: eng ? (num(totals[k]) / eng) * 100 : 0,
    color: colorFor(k, accent),
  })).filter(s => s.pct > 0);

  const toggle = (k: Key) => setSelected(prev => (prev === k ? null : k));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {DEFS.map((d, i) => {
          const color = colorFor(d.key, accent);
          const value = num(totals[d.key]);
          const s = share(d.key);
          const lit = hoverSeg === d.key;
          return (
            <div key={d.key} className="contents">
              <div className={lit ? 'h-full ring-2 ring-offset-1 transition-shadow' : 'h-full transition-shadow'} style={lit ? ({ '--tw-ring-color': color } as any) : undefined}>
                <MetricCard
                  color={color}
                  icon={d.icon}
                  label={d.label}
                  active={selected === d.key}
                  onClick={() => toggle(d.key)}
                  controls="influencer-engagement-detail"
                >
                  <p className="font-display text-2xl font-bold tabular-nums leading-none mt-3" style={{ color }}>
                    <CountUp value={value} format={fmt} />
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {s != null ? `${fmtPct(s, s < 1 ? 2 : 1)} of engagement` : posts ? `${fmt(value / posts)} per post` : ''}
                  </p>
                  {s != null && (
                    <div className="h-1 w-full bg-black/[0.06] mt-2 overflow-hidden" aria-hidden>
                      <div className="h-full" style={{ width: `${Math.min(100, s)}%`, background: color, transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
                    </div>
                  )}
                </MetricCard>
              </div>

              {i === after && selected && (
                <EngagementDetail
                  def={DEFS[selectedIdx]}
                  color={colorFor(DEFS[selectedIdx].key, accent)}
                  totals={totals}
                  posts={posts}
                  topPosts={topPosts}
                  onClose={close}
                />
              )}
            </div>
          );
        })}
      </div>

      {mix.length > 0 && (
        <div className="mt-5">
          <SubLabel>Engagement mix: likes, comments and shares</SubLabel>
          <div className="flex h-8 w-full overflow-hidden border border-black/10" onMouseLeave={() => setHoverSeg(null)}>
            {mix.map(seg => (
              <button
                key={seg.key}
                type="button"
                aria-label={`${seg.label}: ${fmt(seg.v)}, ${fmtPct(seg.pct)} of engagement`}
                onMouseEnter={() => setHoverSeg(seg.key)}
                onFocus={() => setHoverSeg(seg.key)}
                onBlur={() => setHoverSeg(null)}
                onClick={() => toggle(seg.key)}
                className="h-full flex items-center justify-center font-mono-ui text-[10px] tracking-[0.08em] text-white overflow-hidden whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{
                  width: `${seg.pct}%`,
                  minWidth: seg.pct > 0 ? 3 : 0,
                  background: seg.color,
                  filter: hoverSeg === seg.key ? 'brightness(1.12) saturate(1.1)' : undefined,
                  transition: 'filter 160ms ease',
                }}
              >
                {seg.pct >= 9 ? `${seg.label} ${seg.pct.toFixed(seg.pct < 1 ? 2 : 1)}%` : ''}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Hover a segment to find its card. Click to open the story. Likes are counted where the platform shares them, so some Instagram posts read low.
          </p>
        </div>
      )}
    </div>
  );
};

function EngagementDetail({ def, color, totals, posts, topPosts, onClose }: {
  def: Def; color: string; totals: Props['totals']; posts: number; topPosts: PostLike[]; onClose: () => void;
}) {
  const k = def.key;
  const value = num(totals[k]);
  const likes = num(totals.likes);
  const comments = num(totals.comments);
  const views = num(totals.views);
  const shares = num(totals.shares);
  const eng = num(totals.engagements);

  const ranked = useMemo(() => {
    return arr<PostLike>(topPosts)
      .map(p => ({ p, v: num((p as any)[k]) }))
      .filter(r => r.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
  }, [topPosts, k]);

  const tiles: { label: string; value: string; hint?: string }[] = [];
  const insights: string[] = [];

  if (posts) tiles.push({ label: `${def.label} per post`, value: fmt(value / posts) });
  if (k === 'likes') {
    if (views) tiles.push({ label: 'Likes per 1,000 views', value: ((likes / views) * 1000).toFixed(0), hint: 'How often a view turns into a like' });
    if (eng) tiles.push({ label: 'Share of engagement', value: fmtPct((likes / eng) * 100) });
    if (views) insights.push(`About ${((likes / views) * 100).toFixed(1)} in every 100 views ends in a like.`);
  } else if (k === 'comments') {
    if (likes) tiles.push({ label: 'Comments per 1,000 likes', value: ((comments / likes) * 1000).toFixed(0), hint: 'Higher means people are talking, not just tapping' });
    if (views) tiles.push({ label: 'Comments per 1,000 views', value: ((comments / views) * 1000).toFixed(1) });
    if (likes) insights.push(`For every 100 likes there are ${((comments / likes) * 100).toFixed(1)} comments.`);
  } else if (k === 'views') {
    if (eng && views) tiles.push({ label: 'Engagements per 1,000 views', value: ((eng / views) * 1000).toFixed(0), hint: 'Likes, comments and shares combined' });
    if (shares && views) tiles.push({ label: 'Views per share', value: fmt(views / shares) });
    if (eng && views) insights.push(`Roughly ${((eng / views) * 100).toFixed(1)}% of views turn into a like, comment or share.`);
  } else {
    if (likes) tiles.push({ label: 'Shares per 1,000 likes', value: ((shares / likes) * 1000).toFixed(0), hint: 'A gauge of how share-worthy the content is' });
    if (eng) tiles.push({ label: 'Share of engagement', value: fmtPct((shares / eng) * 100, 2) });
    if (likes) insights.push(`For every 100 likes, the content was shared ${((shares / likes) * 100).toFixed(1)} times.`);
  }
  if (ranked.length && ranked[0].v > 0 && value > 0) {
    const r = ranked[0];
    insights.push(`${r.p.author_name || 'One creator'}'s top post alone drove ${fmt(r.v)} ${def.label.toLowerCase()}.`);
  }

  return (
    <DetailShell
      id="influencer-engagement-detail"
      color={color}
      icon={def.icon}
      label={def.label}
      value={fmt(value)}
      sub={posts ? `${fmt(value / posts)} per post across ${fmt(posts)} posts` : undefined}
      blurb={def.blurb}
      onClose={onClose}
    >
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-2">
          <SubLabel>The ratios that matter</SubLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {tiles.map(t => <Tile key={t.label} label={t.label} value={t.value} hint={t.hint} />)}
          </div>
        </div>

        <div className="lg:col-span-3">
          <SubLabel>{`Strongest posts for ${def.label.toLowerCase()} (among your top posts)`}</SubLabel>
          {ranked.length ? (
            <ul className="divide-y divide-black/[0.08]">
              {ranked.map((r, i) => (
                <li key={r.p.id} className="py-2.5 flex items-center gap-3">
                  <span
                    className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-display text-xs font-bold text-white"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{r.p.author_name || 'Creator'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{[r.p.campaign_name, r.p.network].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="font-display text-lg font-bold tabular-nums" style={{ color }}>{fmt(r.v)}</span>
                  {r.p.post_link && (
                    <a
                      href={r.p.post_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open post"
                      className="p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-6">No post-level {def.label.toLowerCase()} available for the top posts in this window.</p>
          )}
        </div>
      </div>

      <Chips items={insights.slice(0, 4)} color={color} />
    </DetailShell>
  );
}

export default InfluencerEngagementCards;
