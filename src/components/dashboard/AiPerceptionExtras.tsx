/* eslint-disable @typescript-eslint/no-explicit-any -- peec_* RPCs are not in the generated Supabase types yet */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, BookOpen, ExternalLink, FileText, Megaphone, MessageSquare, ShieldAlert, ShieldCheck, Star, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Chips, DetailShell, SubLabel, arr, num, useEscape, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * AI Visibility: two Peec datasets the tab did not use before.
 * 1. Objections: the recurring arguments AI raises against the brand when a buyer is deciding, with the
 *    pages behind each one. RPC: peec_objections_overview
 * 2. AI action plan: Peec's recommended actions (outreach, content, technical fixes), ranked by expected
 *    impact and tracked by status. RPC: peec_action_plan
 * Both are refreshed weekly by the "Peec Perception Extras" n8n workflow.
 * ---------------------------------------------------------------------------------------------- */

interface Objection {
  name: string; score: number | null; rank: number; members: string[]; member_count: number;
  sources: { url: string; title: string | null; domain: string | null; classification: string | null; stats: Record<string, number> | null }[];
}

const severity = (s: number) => (s >= 60 ? { label: 'Major', color: 'hsl(0 70% 48%)' } : s >= 30 ? { label: 'Notable', color: 'hsl(30 85% 45%)' } : { label: 'Minor', color: 'hsl(220 12% 50%)' });

// A starting point for the PR response, keyed off the objection's wording. Suggestions, not data.
const ANGLES: [RegExp, string][] = [
  [/price|overpric|value|cost|expens/i, 'Reframe on value: cost per use, multi-use formats and size comparisons in reviews and gift guides.'],
  [/packag|plastic|waste|leak/i, 'Lead with packaging facts: refills, recyclability and any redesigns, placed where AI reads (FAQs, press releases).'],
  [/shrink|size|quantit/i, 'Publish clear size and fill information, and get it into product roundups that compare value.'],
  [/shade|undertone|deep skin/i, 'Spotlight shade range and launches with editors and creators who cover inclusive complexion.'],
  [/perform|longev|wear|durab|quality/i, 'Seed wear-test reviews and before/after content that documents performance.'],
  [/formula|reformul|ingredient/i, 'Explain formula changes plainly on owned pages and brief editors on what changed and why.'],
  [/customer service|support|return/i, 'Address service complaints on review sites and make the support policy easy for AI to find.'],
  [/fragrance|scent|sensitiv|irritat/i, 'Publish fragrance-free and sensitive-skin information prominently, with dermatologist backing if available.'],
];
const angleFor = (name: string) => ANGLES.find(([re]) => re.test(name))?.[1] ?? null;

export function AiObjections({ clientId, clientName }: { clientId: string | null; clientName: string | null }) {
  const reduced = usePrefersReducedMotion();
  const [data, setData] = useState<{ synced_at: string | null; total: number; objections: Objection[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: d, error } = await supabase.rpc('peec_objections_overview' as any, { p_client_id: clientId, p_limit: 10 });
      if (cancelled) return;
      if (error) console.error('peec_objections_overview failed:', error);
      setData((d ?? null) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const list = arr<Objection>(data?.objections);
  const brand = clientName || 'the brand';
  if (loading) return <div className="h-48 bg-muted/50 animate-pulse" />;
  if (!list.length) return null;

  const top = list[0];
  const picked = selected ? list.find(o => o.name === selected) ?? null : null;
  const majors = list.filter(o => num(o.score) >= 60).length;

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="h-1" aria-hidden style={{ background: 'linear-gradient(90deg, hsl(0 70% 48%), hsl(30 85% 45%), hsl(220 12% 60%))' }} />
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" aria-hidden /> Objections</p>
            <h3 className="font-display text-xl mt-1">Why AI hesitates to recommend {brand}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">The arguments AI assistants raise against {brand} when a shopper is deciding, grouped by meaning. Higher scores mean the objection comes up more prominently.</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold tabular-nums" style={{ color: severity(num(top.score)).color }}>{top.name}</p>
            <p className="text-[11px] text-muted-foreground">top objection, score {Math.round(num(top.score))} of 100</p>
          </div>
        </div>

        <ul className="mt-5 space-y-1.5">
          {list.map(o => {
            const sv = severity(num(o.score));
            const on = selected === o.name;
            return (
              <li key={o.name}>
                <button type="button" aria-expanded={on} onClick={() => setSelected(p => (p === o.name ? null : o.name))}
                  className="w-full flex items-center gap-3 px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 hover:bg-black/[0.02]"
                  style={{ background: on ? withAlpha(sv.color, 0.08) : undefined, boxShadow: on ? `inset 3px 0 0 ${sv.color}` : undefined }}>
                  <span className="w-5 text-right font-mono-ui text-[10px] text-muted-foreground tabular-nums">{o.rank}</span>
                  <span className="w-44 truncate text-sm font-semibold">{o.name}</span>
                  <span className="flex-1 h-3 bg-black/[0.05]">
                    <span className="block h-full" style={{ width: drawn || reduced ? `${Math.min(100, num(o.score))}%` : '0%', background: `linear-gradient(90deg, ${withAlpha(sv.color, 0.6)}, ${sv.color})`, transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22,1,0.36,1)' }} />
                  </span>
                  <span className="w-10 text-right font-display font-bold tabular-nums">{Math.round(num(o.score))}</span>
                  <span className="w-16 text-right font-mono-ui text-[9px] tracking-[0.1em] uppercase" style={{ color: sv.color }}>{sv.label}</span>
                </button>
                {on && picked && (
                  <div className="mt-1 mb-3">
                    <DetailShell id="ai-objection-detail" color={sv.color} icon={AlertTriangle} label="Objection" value={picked.name} sub={`score ${Math.round(num(picked.score))} of 100`} onClose={close}>
                      <div className="grid gap-6 lg:grid-cols-2 mt-4">
                        <div>
                          <SubLabel>{`How AI phrases it (${picked.member_count} variations)`}</SubLabel>
                          <div className="flex flex-wrap gap-1.5">
                            {picked.members.map(m => <span key={m} className="text-[11px] px-2 py-1" style={{ background: withAlpha(sv.color, 0.08) }}>{m}</span>)}
                          </div>
                          {angleFor(picked.name) && (
                            <div className="mt-4 p-3 border-l-[3px]" style={{ borderColor: sv.color, background: withAlpha(sv.color, 0.05) }}>
                              <p className="font-mono-ui text-[9px] tracking-[0.16em] uppercase text-muted-foreground">Suggested PR angle</p>
                              <p className="text-sm mt-1">{angleFor(picked.name)}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <SubLabel>Pages AI reads when it raises this</SubLabel>
                          {picked.sources.length ? (
                            <ul className="divide-y divide-border">
                              {picked.sources.map(s => (
                                <li key={s.url} className="py-2 flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold hover:underline line-clamp-1">{s.title || s.url}</a>
                                    <p className="text-[10px] text-muted-foreground">{s.domain}{s.classification ? ` · ${String(s.classification).toLowerCase()}` : ''}</p>
                                  </div>
                                  <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-1" aria-hidden />
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-sm text-muted-foreground">No source pages recorded for this objection yet.</p>}
                        </div>
                      </div>
                    </DetailShell>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <Chips
          color="hsl(0 70% 48%)"
          items={[
            `${top.name} is the strongest argument AI makes against ${brand}.`,
            majors > 1 ? `${majors} objections score 60 or more, so they come up prominently in buying conversations.` : '',
            data?.total && data.total > list.length ? `${data.total} objections tracked in total. These are the ${list.length} strongest.` : '',
          ].filter(Boolean)}
        />
      </div>
    </div>
  );
}

/* ================================================================================================ */

interface Action {
  id: string; type: string | null; status: string | null; title: string | null; group: string | null; category: string | null;
  target: string | null; platform: string | null; impact: string | null; impact_rank: number; step_count: number | null; completed_step_count: number | null; created_at: string | null;
}

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  TEMPLATE_ACTION: { label: 'Outreach play', icon: Megaphone },
  CONTENT_BRIEF: { label: 'Content brief', icon: FileText },
  CATEGORY_SITUATION_BRIEF: { label: 'Category brief', icon: BookOpen },
  CONTRADICTIONS_EXTERNAL_SOURCES: { label: 'Correct a third-party page', icon: AlertTriangle },
  CONTRADICTIONS_OWNED_SOURCES: { label: 'Fix an owned page', icon: AlertTriangle },
  SEO_ISSUE: { label: 'Technical fix', icon: Wrench },
  ROBOTS_TXT: { label: 'Unblock AI crawlers', icon: Wrench },
  PDP_OPTIMISATION: { label: 'Product page', icon: Star },
  CONTENT_OPTIMISATION: { label: 'Optimise content', icon: FileText },
  MANUAL_ACTION: { label: 'Manual action', icon: MessageSquare },
};
const CATEGORY_LABEL: Record<string, string> = {
  EDITORIAL_PITCH: 'Pitch an editor',
  LISTICLE_COMPARISON_INCLUSION: 'Get into best-of lists',
  REVIEW_DIRECTORY_OPTIMIZATION: 'Reviews and directories',
  COMMUNITY_ENGAGEMENT: 'Community',
  SOCIAL_CONTENT: 'Social content',
};
const IMPACT: Record<string, { label: string; color: string }> = {
  VERY_HIGH: { label: 'Very high', color: 'hsl(152 60% 30%)' },
  HIGH: { label: 'High', color: 'hsl(152 45% 40%)' },
  MEDIUM: { label: 'Medium', color: 'hsl(40 80% 40%)' },
  LOW: { label: 'Low', color: 'hsl(220 10% 50%)' },
  VERY_LOW: { label: 'Very low', color: 'hsl(220 10% 62%)' },
};
const STATUS: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: 'In progress', color: 'hsl(226 67% 40%)' },
  PENDING: { label: 'To do', color: 'hsl(36 85% 42%)' },
  COMPLETED: { label: 'Done', color: 'hsl(152 55% 32%)' },
};

type Lane = 'all' | 'earned' | 'owned' | 'technical';
const laneOf = (a: Action): Lane => (a.type === 'SEO_ISSUE' || a.type === 'ROBOTS_TXT' ? 'technical' : a.target === 'earned' ? 'earned' : 'owned');

export function AiActionPlan({ clientId, accent }: { clientId: string | null; accent: string }) {
  const [data, setData] = useState<{ synced_at: string | null; by_status: Record<string, number>; actions: Action[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lane, setLane] = useState<Lane>('earned');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: d, error } = await supabase.rpc('peec_action_plan' as any, { p_client_id: clientId });
      if (cancelled) return;
      if (error) console.error('peec_action_plan failed:', error);
      setData((d ?? null) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const actions = useMemo(() => arr<Action>(data?.actions), [data]);
  const counts = useMemo(() => ({
    earned: actions.filter(a => laneOf(a) === 'earned').length,
    owned: actions.filter(a => laneOf(a) === 'owned').length,
    technical: actions.filter(a => laneOf(a) === 'technical').length,
  }), [actions]);

  if (loading) return <div className="h-40 bg-muted/50 animate-pulse" />;
  if (!actions.length) return null;

  const st = data?.by_status ?? {};
  const done = num(st.COMPLETED);
  const live = num(st.ACCEPTED);
  const todo = num(st.PENDING);
  const base = done + live + todo;
  const filtered = actions.filter(a => lane === 'all' || laneOf(a) === lane);
  const shown = showAll ? filtered : filtered.slice(0, 8);
  const veryHighTodo = actions.filter(a => a.status === 'PENDING' && a.impact === 'VERY_HIGH').length;
  const earnedPlatforms = [...new Set(actions.filter(a => laneOf(a) === 'earned' && a.platform).map(a => a.platform as string))];

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="h-1" aria-hidden style={{ background: `linear-gradient(90deg, ${STATUS.COMPLETED.color}, ${STATUS.ACCEPTED.color}, ${STATUS.PENDING.color})` }} />
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">AI action plan</p>
            <h3 className="font-display text-xl mt-1">What moves the needle in AI answers</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">Recommended by Peec from the sources and prompts it tracks, ranked by expected impact. Earned actions are PR opportunities on third-party sites.</p>
          </div>
          <div className="flex gap-5">
            {(['COMPLETED', 'ACCEPTED', 'PENDING'] as const).map(k => (
              <div key={k} className="text-right">
                <p className="font-display text-2xl font-bold tabular-nums" style={{ color: STATUS[k].color }}>{num(st[k])}</p>
                <p className="font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground">{STATUS[k].label}</p>
              </div>
            ))}
          </div>
        </div>

        {base > 0 && (
          <div className="flex h-2.5 w-full overflow-hidden mt-4 bg-black/[0.05]" role="img" aria-label={`${done} done, ${live} in progress, ${todo} to do`}>
            <div style={{ width: `${(done / base) * 100}%`, background: STATUS.COMPLETED.color }} />
            <div style={{ width: `${(live / base) * 100}%`, background: STATUS.ACCEPTED.color }} />
            <div style={{ width: `${(todo / base) * 100}%`, background: withAlpha(STATUS.PENDING.color, 0.55) }} />
          </div>
        )}

        <div role="group" aria-label="Show actions" className="flex flex-wrap gap-1 mt-5">
          {([['earned', `Earned media (${counts.earned})`], ['owned', `Owned content (${counts.owned})`], ['technical', `Technical (${counts.technical})`], ['all', `All (${actions.length})`]] as [Lane, string][]).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={lane === k} onClick={() => { setLane(k); setShowAll(false); }}
              className={cn('px-3 py-1.5 text-[11px] font-semibold border transition-colors focus:outline-none focus-visible:ring-2', lane === k ? 'text-white' : 'border-border text-muted-foreground hover:text-foreground')}
              style={lane === k ? { background: accent, borderColor: accent } : undefined}>
              {label}
            </button>
          ))}
        </div>

        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {shown.map(a => {
            const tm = TYPE_META[a.type ?? ''] ?? { label: a.type ?? 'Action', icon: FileText };
            const Icon = tm.icon;
            const im = IMPACT[a.impact ?? ''] ?? { label: a.impact ?? '—', color: 'hsl(220 10% 55%)' };
            const sm = STATUS[a.status ?? ''] ?? { label: a.status ?? '', color: 'hsl(220 10% 55%)' };
            const steps = num(a.step_count);
            const doneSteps = num(a.completed_step_count);
            const isOpen = open === a.id;
            return (
              <li key={a.id}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(p => (p === a.id ? null : a.id))}
                  className="w-full text-left p-3 border border-border transition-all hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2"
                  style={{ borderLeft: `3px solid ${im.color}`, background: isOpen ? withAlpha(im.color, 0.05) : undefined }}>
                  <div className="flex items-start gap-2">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: withAlpha(im.color, 0.12), color: im.color }}><Icon className="w-3.5 h-3.5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug line-clamp-2">{a.title || tm.label}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="font-mono-ui text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5" style={{ background: withAlpha(im.color, 0.12), color: im.color }}>{im.label} impact</span>
                        <span className="font-mono-ui text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5" style={{ background: withAlpha(sm.color, 0.12), color: sm.color }}>{sm.label}</span>
                        {a.platform && <span className="text-[10px] text-muted-foreground">{a.platform}</span>}
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-3 text-[11px] animate-in fade-in duration-200">
                      <div><p className="text-muted-foreground">Type</p><p className="font-semibold">{tm.label}</p></div>
                      <div><p className="text-muted-foreground">Play</p><p className="font-semibold">{a.category ? (CATEGORY_LABEL[a.category] ?? a.category.replace(/_/g, ' ').toLowerCase()) : '—'}</p></div>
                      <div><p className="text-muted-foreground">Lands on</p><p className="font-semibold">{a.target === 'earned' ? 'A third-party site' : 'A page the brand owns'}</p></div>
                      <div><p className="text-muted-foreground">Raised</p><p className="font-semibold">{a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p></div>
                      {steps > 0 && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground mb-1">{doneSteps} of {steps} steps done</p>
                          <div className="h-1.5 bg-black/[0.06]"><div className="h-full" style={{ width: `${(doneSteps / steps) * 100}%`, background: STATUS.COMPLETED.color }} /></div>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length > 8 && (
          <button type="button" onClick={() => setShowAll(s => !s)} className="mt-3 font-mono-ui text-[10px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground">
            {showAll ? 'Show fewer' : `Show all ${filtered.length}`}
          </button>
        )}

        <Chips
          color={accent}
          items={[
            veryHighTodo ? `${veryHighTodo} very-high-impact actions are still to do.` : '',
            earnedPlatforms.length ? `PR targets in the plan include ${earnedPlatforms.slice(0, 3).join(', ')}.` : '',
            base ? `${Math.round((done / base) * 100)}% of the live plan is complete.` : '',
          ].filter(Boolean)}
        />
      </div>
    </div>
  );
}


/* ================================================================================================ */

interface Claim { claim_id: string; claim: string | null; fact: string | null; verdict: 'supported' | 'contradicted' | string; chats: number | null; channels: string[] | null; last_seen: string | null }

const ENGINE: Record<string, string> = {
  openai: 'ChatGPT', perplexity: 'Perplexity', google: 'Google AI', anthropic: 'Claude', microsoft: 'Copilot', xai: 'Grok',
  deepseek: 'DeepSeek', meta: 'Llama', amazon: 'Rufus', mistral: 'Mistral', qwen: 'Qwen', naver: 'Naver', baidu: 'Baidu',
};
const engineName = (id: string) => ENGINE[id.split('-')[0]] ?? id.split('-')[0];

/** Claims AI makes about the brand, checked against the facts the team has approved in Peec. RPC: peec_accuracy_overview */
export function AiAccuracy({ clientId, clientName }: { clientId: string | null; clientName: string | null }) {
  const reduced = usePrefersReducedMotion();
  const [data, setData] = useState<{ supported: number; contradicted: number; claims: Claim[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'contradicted' | 'supported'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: d, error } = await supabase.rpc('peec_accuracy_overview' as any, { p_client_id: clientId });
      if (cancelled) return;
      if (error) console.error('peec_accuracy_overview failed:', error);
      setData((d ?? null) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const claims = arr<Claim>(data?.claims);
  const supported = num(data?.supported);
  const contradicted = num(data?.contradicted);
  const total = supported + contradicted;
  const brand = clientName || 'the brand';
  if (loading) return <div className="h-40 bg-muted/50 animate-pulse" />;
  if (!total) return null;

  const pct = (supported / total) * 100;
  const good = contradicted === 0;
  const color = good ? 'hsl(152 58% 32%)' : pct >= 80 ? 'hsl(36 85% 42%)' : 'hsl(0 70% 48%)';
  const R = 44;
  const C = 2 * Math.PI * R;
  const shown = claims.filter(c => filter === 'all' || c.verdict === filter);
  const engines = [...new Set(claims.flatMap(c => arr<string>(c.channels).map(engineName)))];

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="h-1" aria-hidden style={{ background: `linear-gradient(90deg, ${color}, ${withAlpha(color, 0.4)})` }} />
      <div className="p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="relative w-28 h-28 shrink-0 self-start sm:self-center" role="img" aria-label={`${Math.round(pct)}% of claims match your facts`}>
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(0 0% 93%)" strokeWidth="9" />
              <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="butt"
                strokeDasharray={`${drawn || reduced ? (pct / 100) * C : 0} ${C}`}
                style={{ transition: reduced ? undefined : 'stroke-dasharray 1000ms cubic-bezier(0.22,1,0.36,1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold tabular-nums" style={{ color }}>{Math.round(pct)}%</span>
              <span className="font-mono-ui text-[8px] tracking-[0.14em] uppercase text-muted-foreground">accurate</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground flex items-center gap-2">
              {good ? <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> : <ShieldAlert className="w-3.5 h-3.5" aria-hidden />} Accuracy check
            </p>
            <h3 className="font-display text-xl mt-1">{good ? `What AI says about ${brand} checks out` : `AI gets some things wrong about ${brand}`}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              {supported} of {total} claims AI assistants made about {brand} match the facts your team approved{contradicted ? `, and ${contradicted} contradict them` : ''}.
              {engines.length ? ` Claims came from ${engines.join(', ')}.` : ''}
            </p>
          </div>
        </div>

        <div role="group" aria-label="Filter claims" className="flex gap-1 mt-5">
          {([['all', `All (${total})`], ['contradicted', `Needs fixing (${contradicted})`], ['supported', `Verified (${supported})`]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={cn('px-3 py-1.5 text-[11px] font-semibold border transition-colors focus:outline-none focus-visible:ring-2', filter === k ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>

        <ul className="mt-3 divide-y divide-border">
          {shown.length === 0 && <li className="py-4 text-sm text-muted-foreground">No claims in this view.</li>}
          {shown.map(c => {
            const bad = c.verdict === 'contradicted';
            const vc = bad ? 'hsl(0 70% 48%)' : 'hsl(152 58% 32%)';
            const key = `${c.claim_id}-${c.fact}`;
            const isOpen = open === key;
            return (
              <li key={key}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(p => (p === key ? null : key))}
                  className="w-full flex items-start gap-3 py-3 px-1 text-left transition-colors hover:bg-black/[0.02] focus:outline-none focus-visible:ring-2">
                  <span className="mt-0.5 shrink-0" style={{ color: vc }}>{bad ? <ShieldAlert className="w-4 h-4" aria-hidden /> : <ShieldCheck className="w-4 h-4" aria-hidden />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{c.claim}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="font-mono-ui text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5" style={{ background: withAlpha(vc, 0.12), color: vc }}>{bad ? 'Contradicts a fact' : 'Verified'}</span>
                      {arr<string>(c.channels).map(ch => engineName(ch)).filter((v, i, a) => a.indexOf(v) === i).map(n => (
                        <span key={n} className="text-[10px] px-1.5 py-0.5 border border-border text-muted-foreground">{n}</span>
                      ))}
                      {num(c.chats) > 0 && <span className="text-[10px] text-muted-foreground">in {c.chats} answer{c.chats === 1 ? '' : 's'}</span>}
                      {c.last_seen && <span className="text-[10px] text-muted-foreground">last seen {new Date(String(c.last_seen).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                    {isOpen && c.fact && (
                      <p className="mt-2 text-xs p-2.5 border-l-[3px] animate-in fade-in duration-200" style={{ borderColor: vc, background: withAlpha(vc, 0.06) }}>
                        <span className="font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground">Judged against your fact</span><br />{c.fact}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <Chips
          color={color}
          items={[
            good ? `Every claim checked so far is consistent with your facts.` : `${contradicted} claim${contradicted === 1 ? '' : 's'} need correcting at the source pages.`,
            engines.length > 1 ? `Tracked across ${engines.length} AI engines.` : '',
          ].filter(Boolean)}
        />
      </div>
    </div>
  );
}