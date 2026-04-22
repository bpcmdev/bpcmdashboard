import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useWeek } from '@/contexts/WeekContext';
import { supabase } from '@/lib/supabase';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ManageEntries from './ManageEntries';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarIcon, Check, Pencil, Trash2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm py-2 px-3 rounded bg-[hsl(145_63%_42%/0.15)] text-[hsl(145_63%_32%)] border border-[hsl(145_63%_42%/0.3)]">
      <Check className="w-4 h-4" />
      {message}
    </div>
  );
}

function DateField({ date, onSelect, label }: { date: Date | undefined; onSelect: (d: Date | undefined) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : 'Pick a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/* ── Pipeline Form ── */
function PipelineForm({ clientId }: { clientId: string | null }) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState<Date>();
  const [eventType, setEventType] = useState('');
  const [description, setDescription] = useState('');
  const [monitorStrings, setMonitorStrings] = useState('');
  const [priority, setPriority] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title || !eventType) return;
    setSubmitting(true);
    const payload = { client_id: clientId, title, event_date: eventDate ? format(eventDate, 'yyyy-MM-dd') : null, event_type: eventType, description, monitor_strings: monitorStrings ? monitorStrings.split(',').map(s => s.trim()).filter(Boolean) : [], priority };
    console.log('[AdminPanel] pipeline_moments insert payload:', payload);
    const { error } = await supabase.from('pipeline_moments').insert(payload);
    if (error) console.error('[AdminPanel] pipeline_moments insert error:', error);
    setSubmitting(false);
    if (!error) {
      setSuccess('Pipeline moment added');
      setTitle(''); setEventDate(undefined); setEventType(''); setDescription(''); setMonitorStrings(''); setPriority('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <Field label="Event Title"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" /></Field>
      <DateField date={eventDate} onSelect={setEventDate} label="Event Date" />
      <Field label="Event Type">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {['launch', 'event', 'corp-comms', 'milestone', 'moment', 'retail'].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" /></Field>
      <Field label="Monitor Strings"><Input value={monitorStrings} onChange={e => setMonitorStrings(e.target.value)} placeholder="Comma separated" /></Field>
      <Field label="Priority">
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
          <SelectContent>
            {['active', 'watch', 'upcoming'].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button onClick={handleSubmit} disabled={submitting || !title} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Pipeline Moment'}
      </Button>
    </div>
  );
}

/* ── Key Wins Form ── */
function KeyWinsForm({ clientId }: { clientId: string | null }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [reach, setReach] = useState('');
  const [tier, setTier] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title) return;
    setSubmitting(true);
    const payload = { client_id: clientId, title, category, description, reach, tier };
    console.log('[AdminPanel] key_wins insert payload:', payload);
    const { error } = await supabase.from('key_wins').insert(payload);
    if (error) console.error('[AdminPanel] key_wins insert error:', error);
    setSubmitting(false);
    if (!error) {
      setSuccess('Key win added');
      setTitle(''); setCategory(''); setDescription(''); setReach(''); setTier('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <Field label="Win Title"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Win title" /></Field>
      <Field label="Category">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {['Corporate Comms', 'Earned Media', 'Influencer & Social', 'Brand Partnership'].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" /></Field>
      <Field label="Reach"><Input value={reach} onChange={e => setReach(e.target.value)} placeholder="e.g. 5.7M" /></Field>
      <Field label="Tier">
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
          <SelectContent>
            {['Tier 1', 'Tier 2', 'Organic'].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button onClick={handleSubmit} disabled={submitting || !title} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Key Win'}
      </Button>
    </div>
  );
}

/* ── Partnerships Form ── */
function PartnershipsForm({ clientId }: { clientId: string | null }) {
  const [partnerName, setPartnerName] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [description, setDescription] = useState('');
  const [emv, setEmv] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!partnerName) return;
    setSubmitting(true);
    const payload = { client_id: clientId, partner_name: partnerName, type, status, description, emv_generated: emv ? Number(emv) : null, notes };
    console.log('[AdminPanel] partnerships insert payload:', payload);
    const { error } = await supabase.from('partnerships').insert(payload);
    if (error) console.error('[AdminPanel] partnerships insert error:', error);
    setSubmitting(false);
    if (!error) {
      setSuccess('Partnership added');
      setPartnerName(''); setType(''); setStatus(''); setDescription(''); setEmv(''); setNotes('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <Field label="Partner Name"><Input value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="Partner name" /></Field>
      <Field label="Type"><Input value={type} onChange={e => setType(e.target.value)} placeholder="e.g. Retail, Creative, Collab" /></Field>
      <Field label="Status">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            {['live', 'in-development', 'past'].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" /></Field>
      <Field label="EMV Generated"><Input type="number" value={emv} onChange={e => setEmv(e.target.value)} placeholder="0" /></Field>
      <Field label="Notes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" /></Field>
      <Button onClick={handleSubmit} disabled={submitting || !partnerName} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Partnership'}
      </Button>
    </div>
  );
}

/* ── Product Launches Form ── */
function ProductLaunchesForm({ clientId }: { clientId: string | null }) {
  const [productName, setProductName] = useState('');
  const [launchType, setLaunchType] = useState('');
  const [description, setDescription] = useState('');
  const [launchDate, setLaunchDate] = useState<Date>();
  const [retailers, setRetailers] = useState('');
  const [status, setStatus] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!productName) return;
    setSubmitting(true);
    const payload = { client_id: clientId, product_name: productName, launch_type: launchType, description, launch_date: launchDate ? format(launchDate, 'yyyy-MM-dd') : null, retailers: retailers ? retailers.split(',').map(s => s.trim()).filter(Boolean) : [], status };
    console.log('[AdminPanel] product_pipeline insert payload:', payload);
    const { error } = await supabase.from('product_pipeline').insert(payload);
    if (error) console.error('[AdminPanel] product_pipeline insert error:', error);
    setSubmitting(false);
    if (!error) {
      setSuccess('Product launch added');
      setProductName(''); setLaunchType(''); setDescription(''); setLaunchDate(undefined); setRetailers(''); setStatus('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <Field label="Product Name"><Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Product name" /></Field>
      <Field label="Launch Type">
        <Select value={launchType} onValueChange={setLaunchType}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {['new-launch', 'hero-launch', 'reformulated', 'entry-product', 'upcoming'].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" /></Field>
      <DateField date={launchDate} onSelect={setLaunchDate} label="Launch Date" />
      <Field label="Retailers"><Input value={retailers} onChange={e => setRetailers(e.target.value)} placeholder="Retailers" /></Field>
      <Field label="Status">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            {['active', 'upcoming', 'in-planning'].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button onClick={handleSubmit} disabled={submitting || !productName} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Product Launch'}
      </Button>
    </div>
  );
}

/* ── Weekly Snapshot Form ── */
function WeeklySnapshotForm({ clientId }: { clientId: string | null }) {
  const [weekStart, setWeekStart] = useState<Date>();
  const [placementCount, setPlacementCount] = useState('');
  const [emvUsd, setEmvUsd] = useState('');
  const [sentimentScore, setSentimentScore] = useState('');
  const [socialReach, setSocialReach] = useState('');
  const [sovPct, setSovPct] = useState('');
  const [influencerRoi, setInfluencerRoi] = useState('');
  const [wowPlacementDelta, setWowPlacementDelta] = useState('');
  const [wowEmvDelta, setWowEmvDelta] = useState('');
  const [wowReachDelta, setWowReachDelta] = useState('');
  const [momSentimentDelta, setMomSentimentDelta] = useState('');
  const [sovDeltaPts, setSovDeltaPts] = useState('');
  const [narrativeWatch, setNarrativeWatch] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!weekStart) return;
    setSubmitting(true);
    const num = (v: string) => v ? Number(v) : null;
    const payload = {
      client_id: clientId,
      week_start: format(weekStart, 'yyyy-MM-dd'),
      placement_count: num(placementCount),
      emv_usd: num(emvUsd),
      sentiment_score: num(sentimentScore),
      social_reach: num(socialReach),
      sov_pct: num(sovPct),
      influencer_roi: num(influencerRoi),
      wow_placement_delta: num(wowPlacementDelta),
      wow_emv_delta: num(wowEmvDelta),
      wow_reach_delta: num(wowReachDelta),
      mom_sentiment_delta: num(momSentimentDelta),
      sov_delta_pts: num(sovDeltaPts),
      narrative_watch: narrativeWatch || null,
    };
    console.log('[AdminPanel] weekly_snapshots insert payload:', payload);
    const { error } = await supabase.from('weekly_snapshots').insert(payload);
    if (error) console.error('[AdminPanel] weekly_snapshots insert error:', error);
    setSubmitting(false);
    if (!error) {
      setSuccess('Weekly snapshot added');
      setWeekStart(undefined); setPlacementCount(''); setEmvUsd(''); setSentimentScore('');
      setSocialReach(''); setSovPct(''); setInfluencerRoi(''); setWowPlacementDelta('');
      setWowEmvDelta(''); setWowReachDelta(''); setMomSentimentDelta(''); setSovDeltaPts('');
      setNarrativeWatch('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <DateField date={weekStart} onSelect={setWeekStart} label="Week Start" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placement Count"><Input type="number" value={placementCount} onChange={e => setPlacementCount(e.target.value)} placeholder="0" /></Field>
        <Field label="EMV (USD)"><Input type="number" value={emvUsd} onChange={e => setEmvUsd(e.target.value)} placeholder="0" /></Field>
        <Field label="Sentiment Score"><Input type="number" value={sentimentScore} onChange={e => setSentimentScore(e.target.value)} placeholder="0.0" /></Field>
        <Field label="Social Reach"><Input type="number" value={socialReach} onChange={e => setSocialReach(e.target.value)} placeholder="0" /></Field>
        <Field label="SOV %"><Input type="number" value={sovPct} onChange={e => setSovPct(e.target.value)} placeholder="0.0" /></Field>
        <Field label="Influencer ROI"><Input type="number" value={influencerRoi} onChange={e => setInfluencerRoi(e.target.value)} placeholder="0.0" /></Field>
      </div>
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground pt-2">Week-over-Week Deltas</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placement Δ"><Input type="number" value={wowPlacementDelta} onChange={e => setWowPlacementDelta(e.target.value)} placeholder="0" /></Field>
        <Field label="EMV Δ"><Input type="number" value={wowEmvDelta} onChange={e => setWowEmvDelta(e.target.value)} placeholder="0" /></Field>
        <Field label="Reach Δ"><Input type="number" value={wowReachDelta} onChange={e => setWowReachDelta(e.target.value)} placeholder="0" /></Field>
        <Field label="Sentiment Δ (MoM)"><Input type="number" value={momSentimentDelta} onChange={e => setMomSentimentDelta(e.target.value)} placeholder="0" /></Field>
        <Field label="SOV Δ (pts)"><Input type="number" value={sovDeltaPts} onChange={e => setSovDeltaPts(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Narrative Watch"><Textarea value={narrativeWatch} onChange={e => setNarrativeWatch(e.target.value)} placeholder="e.g. Turnaround narrative gaining traction — sentiment running 71% positive on leadership story." /></Field>
      <Button onClick={handleSubmit} disabled={submitting || !weekStart} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Weekly Snapshot'}
      </Button>
    </div>
  );
}

/* ── Placements Form ── */
function PlacementsForm({ clientId }: { clientId: string | null }) {
  const { selectedWeek } = useWeek();
  const [headline, setHeadline] = useState('');
  const [url, setUrl] = useState('');
  const [outletName, setOutletName] = useState('');
  const [outletTier, setOutletTier] = useState('');
  const [outletUmv, setOutletUmv] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [publishedAt, setPublishedAt] = useState<Date>();
  const [sentiment, setSentiment] = useState('');
  const [adValue, setAdValue] = useState('');
  const [impressions, setImpressions] = useState('');
  const [placementType, setPlacementType] = useState('');
  const [placedBy, setPlacedBy] = useState('');
  const [tags, setTags] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const num = (v: string) => v ? Number(v) : null;

  const handleSubmit = async () => {
    if (!headline) return;
    setSubmitting(true);

    // Resolve week_id from weekly_snapshots
    let weekId: string | null = null;
    if (selectedWeek && clientId) {
      const { data: snapRow, error: snapErr } = await supabase
        .from('weekly_snapshots')
        .select('id')
        .eq('week_start', selectedWeek)
        .eq('client_id', clientId)
        .maybeSingle();
      if (snapErr) console.error('[AdminPanel] weekly_snapshots lookup error:', snapErr);
      weekId = snapRow?.id ?? null;
    }

    const payload = {
      client_id: clientId,
      week_id: weekId,
      headline,
      url,
      outlet_name: outletName,
      outlet_tier: outletTier ? Number(outletTier) : null,
      outlet_umv: num(outletUmv),
      author_name: authorName,
      published_at: publishedAt ? format(publishedAt, 'yyyy-MM-dd') : null,
      sentiment,
      ad_value: num(adValue),
      impressions: num(impressions),
      placement_type: placementType,
      placed_by: placedBy,
      tags: tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    console.log('[AdminPanel] placements insert payload:', payload);
    const { error } = await supabase.from('placements').insert(payload);
    if (error) console.error('[AdminPanel] placements insert error:', error);
    setSubmitting(false);
    if (!error) {
      setSuccess('Placement added');
      setHeadline(''); setUrl(''); setOutletName(''); setOutletTier(''); setOutletUmv('');
      setAuthorName(''); setPublishedAt(undefined); setSentiment(''); setAdValue('');
      setImpressions(''); setPlacementType(''); setPlacedBy(''); setTags('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <Field label="Headline"><Input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Placement headline" /></Field>
      <Field label="URL"><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Outlet Name"><Input value={outletName} onChange={e => setOutletName(e.target.value)} placeholder="e.g. Allure" /></Field>
        <Field label="Outlet Tier">
          <Select value={outletTier} onValueChange={setOutletTier}>
            <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Outlet UMV"><Input type="number" value={outletUmv} onChange={e => setOutletUmv(e.target.value)} placeholder="0" /></Field>
        <Field label="Author Name"><Input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Author" /></Field>
      </div>
      <DateField date={publishedAt} onSelect={setPublishedAt} label="Published Date" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sentiment">
          <Select value={sentiment} onValueChange={setSentiment}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Placement Type">
          <Select value={placementType} onValueChange={setPlacementType}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="earned">Earned</SelectItem>
              <SelectItem value="newswire">Newswire</SelectItem>
              <SelectItem value="contributed">Contributed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad Value"><Input type="number" value={adValue} onChange={e => setAdValue(e.target.value)} placeholder="0" /></Field>
        <Field label="Impressions"><Input type="number" value={impressions} onChange={e => setImpressions(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Placed By"><Input value={placedBy} onChange={e => setPlacedBy(e.target.value)} placeholder="e.g. BPCM" /></Field>
      <Field label="Tags (comma separated)"><Input value={tags} onChange={e => setTags(e.target.value)} placeholder="skincare, launch" /></Field>
      <Button onClick={handleSubmit} disabled={submitting || !headline} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Placement'}
      </Button>
    </div>
  );
}

/* ── User Management ── */
interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  client_id: string | null;
  invited_at: string | null;
  clients: { name: string } | null;
}

interface ClientOption {
  id: string;
  name: string;
}

function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteClient, setInviteClient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editClient, setEditClient] = useState('');

  const callEdgeFunction = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    let accessToken = session?.access_token;

    if (!accessToken) {
      const { data: { user } } = await supabase.auth.getUser();
      accessToken = (user as { access_token?: string } | null)?.access_token;
    }

    console.log('[UserManagement] admin-users access token:', accessToken ?? null);

    if (!accessToken) throw new Error('Not authenticated');

    const response = await fetch(
      'https://malstqryqfodnqlvrgmn.supabase.co/functions/v1/admin-users',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': (supabase as unknown as { supabaseKey: string }).supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
    return data;
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const cacheBust = Date.now();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, client_id, invited_at, clients(name)')
        .order('full_name')
        .limit(1000);
      if (error) throw error;
      const rows = (data as unknown as UserRow[]) || [];
      console.log('[UserManagement] fetch @', cacheBust, 'first user:', JSON.stringify(rows[0]));
      setUsers(rows);
    } catch (err) {
      console.error('[UserManagement] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, [fetchUsers, fetchClients]);

  const handleInvite = async () => {
    if (!inviteName || !inviteEmail || !inviteRole || !inviteClient) return;
    setSubmitting(true);
    try {
      await callEdgeFunction({
        action: 'invite',
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole,
        client_id: inviteClient,
      });
      setSuccess(`Invite sent to ${inviteEmail}. They'll receive a link to set their password.`);
      setInviteName(''); setInviteEmail(''); setInviteRole(''); setInviteClient('');
      fetchUsers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('[UserManagement] invite error:', err);
      setSuccess('');
    }
    setSubmitting(false);
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: editRole, client_id: editClient })
        .eq('id', editingUser.id);
      if (error) throw error;
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('[UserManagement] update error:', err);
    }
    setSubmitting(false);
  };

  const handleDelete = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);
      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      console.error('[UserManagement] delete error:', err);
    }
  };

  const handleResend = async (user: UserRow) => {
    try {
      await callEdgeFunction({
        action: 'reinvite',
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        client_id: user.client_id,
      });
      toast.success(`Invite resent to ${user.email}`);
    } catch (err: any) {
      console.error('[UserManagement] resend error:', err);
      toast.error(err?.message || 'Failed to resend invite');
    }
  };

  const startEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditClient(user.client_id || '');
  };

  return (
    <div className="space-y-6">
      {success && <SuccessMessage message={success} />}

      {/* Invite Form */}
      <div className="space-y-3 border border-border rounded-lg p-4">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Invite New User</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name"><Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" /></Field>
          <Field label="Email"><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email" /></Field>
          <Field label="Role">
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Client">
            <Select value={inviteClient} onValueChange={setInviteClient}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button onClick={handleInvite} disabled={submitting || !inviteName || !inviteEmail || !inviteRole || !inviteClient} className="w-full bg-foreground text-background hover:bg-foreground/90">
          {submitting ? 'Inviting…' : 'Invite User'}
        </Button>
      </div>

      {/* User List */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Existing Users</p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground">No users found.</p>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold truncate">{user.full_name}</p>
                    {user.invited_at && (
                      <Badge className="bg-yellow-400 text-yellow-950 hover:bg-yellow-400 border-transparent text-[9px] px-1.5 py-0 h-4">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {user.role} · {user.clients?.name || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {user.invited_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Resend invite"
                      onClick={() => handleResend(user)}
                    >
                      <Mail className="w-3 h-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(user)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {user.full_name}? This will remove them from both the database and authentication system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(user.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingUser && (
        <AlertDialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit {editingUser.full_name}</AlertDialogTitle>
              <AlertDialogDescription>Update role or client assignment.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <Field label="Role">
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Client">
                <Select value={editClient} onValueChange={setEditClient}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUpdate} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Changes'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/* ── Main Panel ── */
export default function AdminPanel({ open, onOpenChange, clientId }: AdminPanelProps) {
  const [adminSection, setAdminSection] = useState('pipeline');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-background border-border p-0">
        <div className="bg-foreground text-background px-6 py-4">
          <SheetTitle className="text-background text-sm font-bold tracking-widest uppercase">Admin Data Entry</SheetTitle>
        </div>
        <div className="p-6 space-y-6">
          <Select value={adminSection} onValueChange={setAdminSection}>
            <SelectTrigger className="w-full text-xs font-semibold tracking-widest uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pipeline" className="text-xs tracking-wider uppercase">Pipeline</SelectItem>
              <SelectItem value="keywins" className="text-xs tracking-wider uppercase">Key Wins</SelectItem>
              <SelectItem value="partnerships" className="text-xs tracking-wider uppercase">Partners</SelectItem>
              <SelectItem value="products" className="text-xs tracking-wider uppercase">Products</SelectItem>
              <SelectItem value="placements" className="text-xs tracking-wider uppercase">Placements</SelectItem>
              <SelectItem value="snapshot" className="text-xs tracking-wider uppercase">Snapshot</SelectItem>
              <SelectItem value="users" className="text-xs tracking-wider uppercase">Users</SelectItem>
            </SelectContent>
          </Select>
          {adminSection === 'pipeline' && <PipelineForm clientId={clientId} />}
          {adminSection === 'keywins' && <KeyWinsForm clientId={clientId} />}
          {adminSection === 'partnerships' && <PartnershipsForm clientId={clientId} />}
          {adminSection === 'products' && <ProductLaunchesForm clientId={clientId} />}
          {adminSection === 'placements' && <PlacementsForm clientId={clientId} />}
          {adminSection === 'snapshot' && <WeeklySnapshotForm clientId={clientId} />}
          {adminSection === 'users' && <UserManagement />}

          {/* Manage Entries section */}
          <div className="border-t border-border pt-6">
            <ManageEntries clientId={clientId} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
