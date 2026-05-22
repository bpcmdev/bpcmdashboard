import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import DataStateWrapper from './DataStateWrapper';
import EmptyState from './EmptyState';
import { formatReach, formatMoney } from '@/lib/format';
import { LinkPreviewTrigger } from './LinkPreviewDrawer';

interface LeftyPost {
  id: string;
  campaign_name: string | null;
  network: string | null;
  author_name: string | null;
  followers: number | null;
  impressions: number | null;
  reach: number | null;
  emv: number | null;
  engagement_rate: number | null;
  post_link: string | null;
  posted_at?: string | null;
}

const fmtMoney = formatMoney;

const normalizeNetwork = (n: string | null): string => {
  if (!n) return 'Other';
  const v = n.toLowerCase();
  if (v.includes('insta')) return 'Instagram';
  if (v.includes('tiktok') || v.includes('tt')) return 'TikTok';
  if (v.includes('youtube') || v === 'yt') return 'YouTube';
  if (v.includes('linkedin')) return 'LinkedIn';
  if (v.includes('twitter') || v === 'x') return 'X';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
};

const InfluencerSocialTab = () => {
  const { activeClientId, refreshKey, effectiveFrom, effectiveTo, isAllTime } = useWeek();
  const { clientColor } = useAdmin();
  const accent = clientColor || '#1B2B8A';
  const [posts, setPosts] = useState<LeftyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activeClientId) return;
    // In weekly/range mode we need a resolved date window; in all-time mode we skip the filter entirely.
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      const PAGE = 1000;
      const all: LeftyPost[] = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from('lefty_posts')
          .select('id, campaign_name, network, author_name, followers, impressions, reach, emv, engagement_rate, post_link, posted_at')
          .eq('client_id', activeClientId)
          .order('posted_at', { ascending: false });
        if (!isAllTime) {
          q = q
            .gte('posted_at', effectiveFrom)
            .lte('posted_at', `${effectiveTo}T23:59:59.999Z`);
        }
        const { data, error: err } = await q.range(from, from + PAGE - 1);
        if (cancelled) return;
        if (err) { setError(true); setLoading(false); return; }
        const batch = (data as LeftyPost[]) ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
        if (from > 50000) break; // safety
      }
      if (cancelled) return;
      setPosts(all);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, refreshKey, effectiveFrom, effectiveTo, isAllTime]);

  const stats = useMemo(() => {
    const totalPosts = posts.length;
    const totalImpressions = posts.reduce((s, p) => s + (p.impressions ?? 0), 0);
    const totalEmv = posts.reduce((s, p) => s + (p.emv ?? 0), 0);
    const engRates = posts.map(p => p.engagement_rate).filter((v): v is number => typeof v === 'number' && v > 0);
    const avgEng = engRates.length ? engRates.reduce((s, v) => s + v, 0) / engRates.length : 0;

    const networkMap = new Map<string, { posts: number; impressions: number; emv: number }>();
    posts.forEach(p => {
      const key = normalizeNetwork(p.network);
      const cur = networkMap.get(key) ?? { posts: 0, impressions: 0, emv: 0 };
      cur.posts += 1;
      cur.impressions += p.impressions ?? 0;
      cur.emv += p.emv ?? 0;
      networkMap.set(key, cur);
    });
    const networks = Array.from(networkMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.posts - a.posts);

    const topPosts = [...posts]
      .sort((a, b) => (b.emv ?? 0) - (a.emv ?? 0))
      .slice(0, 10);

    return { totalPosts, totalImpressions, totalEmv, avgEng, networks, topPosts };
  }, [posts]);

  return (
    <div className="p-6 space-y-6">
      <DataStateWrapper loading={loading} error={error} skeletonCount={4}>
        {posts.length === 0 ? (
          <EmptyState icon="📣" title="No influencer posts yet" description="Once posts are synced, performance will appear here." />
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Posts', value: stats.totalPosts.toLocaleString() },
                { label: 'Total Impressions', value: formatReach(stats.totalImpressions) },
                { label: 'Total EMV', value: fmtMoney(stats.totalEmv) },
                { label: 'Avg Engagement', value: `${stats.avgEng.toFixed(2)}%` },
              ].map((k) => (
                <div key={k.label} className="bg-card border border-black/10 p-5">
                  <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">{k.label}</p>
                  <p className="font-display text-2xl font-bold text-foreground">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Network breakdown */}
            <div className="bg-card border border-black/10 p-5">
              <h3 className="section-label mb-4">Network Breakdown</h3>
              <ResponsiveContainer width="100%" height={Math.max(180, stats.networks.length * 56)}>
                <BarChart data={stats.networks} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'hsl(0 0% 20%)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4, fontSize: 11 }}
                    formatter={(value: number, name: string) => {
                      if (name === 'EMV') return [fmtMoney(value), name];
                      if (name === 'Impressions') return [formatReach(value), name];
                      return [value.toLocaleString(), name];
                    }}
                  />
                  <Bar dataKey="posts" name="Posts" fill={accent} maxBarSize={20} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-black/10">
                {stats.networks.map((n) => (
                  <div key={n.name}>
                    <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">{n.name}</p>
                    <p className="text-xs text-foreground">{n.posts.toLocaleString()} posts · {formatReach(n.impressions)} imp · {fmtMoney(n.emv)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 posts by EMV */}
            <div className="bg-card border border-black/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="section-label">Top 10 Posts by EMV</span>
                <span className="section-count">{stats.topPosts.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-black/10">
                      {['#', 'Author', 'Campaign', 'Network', 'EMV'].map((h) => (
                        <th key={h} className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topPosts.map((p, i) => (
                      <tr key={p.id} className="border-b border-black/5">
                        <td className="py-3 pr-4 font-mono-ui text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {p.post_link ? (
                            <a href={p.post_link} target="_blank" rel="noreferrer" className="hover:underline">{p.author_name ?? '—'}</a>
                          ) : (p.author_name ?? '—')}
                        </td>
                        <td className="py-3 pr-4 text-foreground/80 truncate max-w-xs">{p.campaign_name ?? '—'}</td>
                        <td className="py-3 pr-4">
                          <span className="font-mono-ui text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 bg-foreground text-white">
                            {normalizeNetwork(p.network)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-display font-bold text-foreground">{fmtMoney(p.emv ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </DataStateWrapper>
    </div>
  );
};

export default InfluencerSocialTab;
