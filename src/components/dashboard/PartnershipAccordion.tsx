import { useEffect, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import { formatMoney, formatCount } from '@/lib/format';
import EditPartnershipDialog from './EditPartnershipDialog';
import DeleteEntryButton from './DeleteEntryButton';
import { LinkPreviewTrigger } from './LinkPreviewDrawer';

interface PartnershipLite {
  id: string;
  partner_name: string;
  type: string;
  status: string;
  description: string;
  emv_generated: number | null;
  notes?: string | null;
}

interface Props {
  partnership: PartnershipLite;
  statusBadge: { label: string; style: string };
  accent: string;
  isAdmin?: boolean;
  variant?: 'card' | 'row';
}

interface PostLite {
  id: string;
  author_name: string | null;
  network: string | null;
  campaign_name: string | null;
  reach: number | null;
  emv: number | null;
  engagement_rate: number | null;
  post_link: string | null;
  posted_at: string | null;
}

const getPostUrl = (post: Partial<PostLite> & Record<string, unknown>) => {
  const candidates = [
    post.post_link,
    post.url,
    post.link,
    post.post_url,
    post.permalink,
    post.media_url,
    post.source_url,
  ];
  return candidates.find((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value.trim()))?.trim();
};

const normalizePost = (post: Record<string, unknown>): PostLite => ({
  id: String(post.id ?? crypto.randomUUID()),
  author_name: typeof post.author_name === 'string' ? post.author_name : null,
  network: typeof post.network === 'string' ? post.network : null,
  campaign_name: typeof post.campaign_name === 'string' ? post.campaign_name : null,
  reach: typeof post.reach === 'number' ? post.reach : null,
  emv: typeof post.emv === 'number' ? post.emv : null,
  engagement_rate: typeof post.engagement_rate === 'number' ? post.engagement_rate : null,
  post_link: getPostUrl(post) ?? null,
  posted_at: typeof post.posted_at === 'string' ? post.posted_at : null,
});

const PartnershipAccordion = ({ partnership, statusBadge, accent, isAdmin, variant = 'card' }: Props) => {
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<PostLite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { activeClientId, isAllTime, effectiveFrom, effectiveTo } = useWeek();

  useEffect(() => {
    if (!open || posts !== null || !activeClientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const name = partnership.partner_name.trim();
      // Match posts by campaign_name containing the partner name (best-effort, no FK exists).
      let q = supabase
        .from('lefty_posts')
        .select('*')
        .eq('client_id', activeClientId)
        .ilike('campaign_name', `%${name}%`)
        .order('emv', { ascending: false })
        .limit(50);
      if (!isAllTime && effectiveFrom && effectiveTo) {
        q = q.gte('posted_at', effectiveFrom).lte('posted_at', `${effectiveTo}T23:59:59.999Z`);
      }
      const { data } = await q;
      if (cancelled) return;
      setPosts(((data ?? []) as Record<string, unknown>[]).map(normalizePost));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, posts, activeClientId, isAllTime, effectiveFrom, effectiveTo, partnership.partner_name]);

  const initials = partnership.partner_name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  // Aggregations
  const breakdown = (() => {
    const list = posts ?? [];
    const totalEmv = list.reduce((s, p) => s + (p.emv ?? 0), 0);
    const totalReach = list.reduce((s, p) => s + (p.reach ?? 0), 0);
    const byAuthor = new Map<string, { name: string; emv: number; reach: number; posts: number; topPost: PostLite }>();
    for (const p of list) {
      const k = p.author_name ?? '—';
      const cur = byAuthor.get(k) ?? { name: k, emv: 0, reach: 0, posts: 0, topPost: p };
      cur.emv += p.emv ?? 0;
      cur.reach += p.reach ?? 0;
      cur.posts += 1;
      const currentHasUrl = Boolean(getPostUrl(cur.topPost as unknown as Record<string, unknown>));
      const nextHasUrl = Boolean(getPostUrl(p as unknown as Record<string, unknown>));
      if ((nextHasUrl && !currentHasUrl) || (nextHasUrl === currentHasUrl && (p.emv ?? 0) > (cur.topPost.emv ?? 0))) cur.topPost = p;
      byAuthor.set(k, cur);
    }
    const topAuthors = Array.from(byAuthor.values()).sort((a, b) => b.emv - a.emv).slice(0, 3);
    const linkedPosts = list.filter((p) => Boolean(getPostUrl(p as unknown as Record<string, unknown>)));
    const topPosts = (linkedPosts.length ? linkedPosts : list).slice(0, 5);
    return { totalEmv, totalReach, topAuthors, topPosts, count: list.length };
  })();

  const postMeta = (p: PostLite, extra?: { posts?: number }) => [
    { label: 'Partner', value: partnership.partner_name },
    { label: 'Creator', value: p.author_name ?? '—' },
    { label: 'Network', value: (p.network ?? '—').toString() },
    { label: 'EMV', value: formatMoney(p.emv ?? 0) },
    ...(p.reach ? [{ label: 'Reach', value: formatCount(p.reach) }] : []),
    ...(p.engagement_rate != null
      ? [{ label: 'Engagement', value: `${(p.engagement_rate * 100).toFixed(2)}%` }]
      : []),
    ...(p.posted_at
      ? [{ label: 'Posted', value: new Date(p.posted_at).toLocaleDateString() }]
      : []),
    ...(extra?.posts ? [{ label: 'Total Posts', value: String(extra.posts) }] : []),
  ];

  const containerCls =
    variant === 'card'
      ? 'entry-card cat-partnership bg-card border border-black/10'
      : 'bg-card';
  const headerCls =
    variant === 'card'
      ? 'flex items-start gap-3 p-4 text-left w-full cursor-pointer hover:bg-black/[0.02] transition-colors'
      : 'flex items-center gap-4 py-3 text-left w-full cursor-pointer hover:bg-black/[0.02] transition-colors';

  return (
    <div className={containerCls} style={{ borderLeft: open ? `2px solid ${accent}` : undefined }}>
      <button type="button" onClick={() => setOpen(o => !o)} className={headerCls}>
        {variant === 'card' && (
          <div
            className="w-9 h-9 flex items-center justify-center text-[11px] font-bold text-white shrink-0 rounded-sm"
            style={{ background: `linear-gradient(135deg, ${accent} 0%, #047857 100%)` }}
          >
            {initials || '—'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-foreground truncate">{partnership.partner_name}</h4>
              {variant === 'card' && <p className="text-[11px] text-muted-foreground">{partnership.type}</p>}
              {variant === 'row' && <p className="text-[11px] text-muted-foreground truncate">{partnership.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`font-mono-ui text-[9px] font-medium tracking-[0.12em] uppercase px-1.5 py-0.5 ${statusBadge.style}`}>
                {statusBadge.label}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </div>
          </div>
          {variant === 'card' && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{partnership.description}</p>
          )}
          {variant === 'card' && partnership.emv_generated ? (
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">EMV</span>
              <span className="font-display text-base font-bold" style={{ color: 'hsl(42 64% 38%)' }}>
                {formatMoney(partnership.emv_generated)}
              </span>
            </div>
          ) : null}
          {variant === 'row' && partnership.emv_generated ? (
            <p className="text-[10px] text-muted-foreground mt-0.5">{formatMoney(partnership.emv_generated)} EMV generated</p>
          ) : null}
        </div>
      </button>

      {open && (
        <div className="border-t border-black/[0.08] bg-[hsl(0,0%,99%)] px-4 py-4 animate-fade-in space-y-4">
          {/* Tracked totals */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tracked Posts', value: loading ? '…' : String(breakdown.count) },
              { label: 'Tracked Reach', value: loading ? '…' : formatCount(breakdown.totalReach) },
              { label: 'Tracked EMV', value: loading ? '…' : formatMoney(breakdown.totalEmv) },
            ].map(stat => (
              <div key={stat.label} className="border border-black/[0.08] bg-white px-3 py-2">
                <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">{stat.label}</p>
                <p className="font-display text-base font-bold tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="h-24 bg-black/[0.04] animate-pulse rounded-sm" />
          ) : breakdown.count === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No matching influencer posts found yet for this partnership.
            </p>
          ) : (
            <>
              {/* Top influencers */}
              <div>
                <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                  Top Influencers
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {breakdown.topAuthors.map((a) => (
                    <LinkPreviewTrigger
                      key={a.name}
                      url={a.topPost.post_link ?? undefined}
                      meta={postMeta(a.topPost, { posts: a.posts })}
                      className="bg-white border border-black/[0.08] px-3 py-2 text-left hover:bg-black/[0.02] transition-colors w-full cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.posts} post{a.posts === 1 ? '' : 's'} · {formatCount(a.reach)} reach
                      </p>
                      <p className="font-display text-sm font-bold mt-0.5" style={{ color: accent }}>
                        {formatMoney(a.emv)}
                      </p>
                    </LinkPreviewTrigger>
                  ))}
                </div>
              </div>

              {/* Top posts */}
              <div>
                <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                  Top Posts by EMV
                </p>
                <div className="border border-black/[0.08] divide-y divide-black/[0.06] bg-white">
                  {breakdown.topPosts.map((p, i) => (
                    <LinkPreviewTrigger
                      key={p.id}
                      url={p.post_link ?? undefined}
                      meta={postMeta(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-black/[0.02] text-left cursor-pointer"
                    >
                      <span className="font-mono-ui text-[10px] text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{p.author_name ?? 'Creator'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(p.network ?? '').toString()}
                          {p.reach ? ` · ${formatCount(p.reach)} reach` : ''}
                        </p>
                      </div>
                      <span className="font-display text-xs font-bold tabular-nums shrink-0">{formatMoney(p.emv ?? 0)}</span>
                      {p.post_link && <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </LinkPreviewTrigger>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Admin actions moved into the expanded panel */}
          {isAdmin && (
            <div className="flex items-center gap-2 pt-2 border-t border-black/[0.06]">
              <span className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mr-1">
                Admin
              </span>
              <EditPartnershipDialog entry={{ ...partnership, notes: partnership.notes ?? '' }} />
              <DeleteEntryButton table="partnerships" id={partnership.id} label="this partnership" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PartnershipAccordion;
