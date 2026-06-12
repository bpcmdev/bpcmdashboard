import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useWeek } from '@/contexts/WeekContext';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';
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
import { Switch } from '@/components/ui/switch';
import { ALL_TABS } from '@/lib/dashboardTabs';
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
export function PipelineForm({ clientId }: { clientId: string | null }) {
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
    const { data: inserted, error } = await supabase.from('pipeline_moments').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] pipeline_moments insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'pipeline_moment', entity_id: inserted?.id, entity_title: title, metadata: { event_type: eventType, priority } });
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
export function KeyWinsForm({ clientId }: { clientId: string | null }) {
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
    const { data: inserted, error } = await supabase.from('key_wins').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] key_wins insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'key_win', entity_id: inserted?.id, entity_title: title, metadata: { category, tier } });
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

/* ── Glance Cards Form ── */
export function GlanceCardsForm({ clientId }: { clientId: string | null }) {
  const { selectedWeek } = useWeek();
  const [weekStart, setWeekStart] = useState<Date | undefined>(selectedWeek ? new Date(selectedWeek + 'T00:00:00') : undefined);
  const [category, setCategory] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [statLine, setStatLine] = useState('');
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!headline) return;
    setSubmitting(true);
    const payload = {
      client_id: clientId,
      week_start: weekStart ? format(weekStart, 'yyyy-MM-dd') : null,
      category, headline, body, stat_line: statLine, featured,
      sort_order: sortOrder ? Number(sortOrder) : 0,
    };
    console.log('[AdminPanel] glance_cards insert payload:', payload);
    const { data: inserted, error } = await supabase.from('glance_cards').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] glance_cards insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'glance_card', entity_id: inserted?.id, entity_title: headline, metadata: { category, featured } });
      setSuccess('Glance card added');
      setCategory(''); setHeadline(''); setBody(''); setStatLine(''); setFeatured(false); setSortOrder('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <DateField date={weekStart} onSelect={setWeekStart} label="Week Start" />
      <Field label="Category"><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Earned Media" /></Field>
      <Field label="Headline"><Input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Bold headline" /></Field>
      <Field label="Body"><Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="1-2 line summary" /></Field>
      <Field label="Stat Line"><Input value={statLine} onChange={e => setStatLine(e.target.value)} placeholder="e.g. 3.2M IMPRESSIONS · 14 PLACEMENTS" /></Field>
      <div className="flex items-center justify-between border border-border rounded px-3 py-2">
        <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Featured</label>
        <Switch checked={featured} onCheckedChange={setFeatured} />
      </div>
      <Field label="Sort Order"><Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="0" /></Field>
      <Button onClick={handleSubmit} disabled={submitting || !headline} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Glance Card'}
      </Button>
    </div>
  );
}

/* ── Asset Tracker Form ── */
export function AssetTrackerForm({ clientId }: { clientId: string | null }) {
  const [launch, setLaunch] = useState('');
  const [targetDate, setTargetDate] = useState<Date>();
  const [status, setStatus] = useState('');
  const [assetsNeeded, setAssetsNeeded] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!launch || !status) return;
    setSubmitting(true);
    const payload = {
      client_id: clientId,
      launch,
      target_date: targetDate ? format(targetDate, 'yyyy-MM-dd') : null,
      status,
      assets_needed: assetsNeeded,
      notes,
    };
    console.log('[AdminPanel] asset_tracker insert payload:', payload);
    const { data: inserted, error } = await supabase.from('asset_tracker').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] asset_tracker insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'asset_tracker', entity_id: inserted?.id, entity_title: launch, metadata: { status } });
      setSuccess('Asset tracker entry added');
      setLaunch(''); setTargetDate(undefined); setStatus(''); setAssetsNeeded(''); setNotes('');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {success && <SuccessMessage message={success} />}
      <Field label="Launch"><Input value={launch} onChange={e => setLaunch(e.target.value)} placeholder="Launch / project name" /></Field>
      <DateField date={targetDate} onSelect={setTargetDate} label="Target Date" />
      <Field label="Status">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="due_soon">Due soon</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Assets Needed"><Textarea value={assetsNeeded} onChange={e => setAssetsNeeded(e.target.value)} placeholder="What's outstanding" /></Field>
      <Field label="Notes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context" /></Field>
      <Button onClick={handleSubmit} disabled={submitting || !launch || !status} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Asset Entry'}
      </Button>
    </div>
  );
}

/* ── Partnerships Form ── */
export function PartnershipsForm({ clientId }: { clientId: string | null }) {
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
    const { data: inserted, error } = await supabase.from('partnerships').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] partnerships insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'partnership', entity_id: inserted?.id, entity_title: partnerName, metadata: { type, status } });
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
export function ProductLaunchesForm({ clientId }: { clientId: string | null }) {
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
    const { data: inserted, error } = await supabase.from('product_pipeline').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] product_pipeline insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'product_launch', entity_id: inserted?.id, entity_title: productName, metadata: { launch_type: launchType, status } });
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
export function WeeklySnapshotForm({ clientId }: { clientId: string | null }) {
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
    };
    console.log('[AdminPanel] weekly_snapshots insert payload:', payload);
    const { data: inserted, error } = await supabase.from('weekly_snapshots').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] weekly_snapshots insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'weekly_snapshot', entity_id: inserted?.id, entity_title: `Week of ${format(weekStart, 'PP')}`, metadata: { week_start: format(weekStart, 'yyyy-MM-dd') } });
      setSuccess('Weekly snapshot added');
      setWeekStart(undefined); setPlacementCount(''); setEmvUsd(''); setSentimentScore('');
      setSocialReach(''); setSovPct(''); setInfluencerRoi(''); setWowPlacementDelta('');
      setWowEmvDelta(''); setWowReachDelta(''); setMomSentimentDelta(''); setSovDeltaPts('');
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
      <Button onClick={handleSubmit} disabled={submitting || !weekStart} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Weekly Snapshot'}
      </Button>
    </div>
  );
}

/* ── Placements Form ── */
export function PlacementsForm({ clientId }: { clientId: string | null }) {
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
    const { data: inserted, error } = await supabase.from('placements').insert(payload).select('id').single();
    if (error) console.error('[AdminPanel] placements insert error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ client_id: clientId, action: 'created', entity_type: 'placement', entity_id: inserted?.id, entity_title: headline, metadata: { outlet_name: outletName, outlet_tier: outletTier } });
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
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  clients: { name: string } | null;
  client_name?: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

export function UserManagement() {
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    setPasswordLoading(true);
    setPasswordError('');
    try {
      await callEdgeFunction({ action: 'set_password', userId: selectedUserId, password: newPassword });
      setPasswordSuccess(true);
      setNewPassword('');
      setTimeout(() => { setSelectedUserId(null); setPasswordSuccess(false); }, 2000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to set password. Please try again.');
    }
    setPasswordLoading(false);
  };

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
      const data = await callEdgeFunction({ action: 'list' });
      const rows = ((data?.users as unknown) as UserRow[]) || [];
      console.log('[UserManagement] fetch @', cacheBust, 'first user:', JSON.stringify(rows[0]));
      setUsers(rows);
    } catch (err) {
      console.error('[UserManagement] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [callEdgeFunction]);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, [fetchUsers, fetchClients]);

  const handleInvite = async () => {
    if (!inviteName || !inviteEmail || !inviteRole) return;
    if (inviteRole === 'client' && !inviteClient) return;
    setSubmitting(true);
    try {
      await callEdgeFunction({
        action: 'invite',
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole,
        client_id: inviteRole === 'admin' ? null : inviteClient,
      });
      logActivity({ client_id: inviteRole === 'admin' ? null : inviteClient, action: 'invited', entity_type: 'user', entity_title: inviteName, metadata: { email: inviteEmail, role: inviteRole } });
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
    console.log('[UserManagement] update clicked for user:', editingUser.id);
    setSubmitting(true);
    try {
      await callEdgeFunction({
        action: 'update',
        user_id: editingUser.id,
        role: editRole,
        client_id: editClient,
      });
      logActivity({ client_id: editClient || editingUser.client_id, action: 'updated', entity_type: 'user', entity_id: editingUser.id, entity_title: editingUser.full_name, metadata: { role: editRole } });
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('[UserManagement] update error:', err);
    }
    setSubmitting(false);
  };

  const handleDelete = async (userId: string) => {
    console.log('[UserManagement] delete clicked for user:', userId);
    const target = users.find(u => u.id === userId);
    try {
      await callEdgeFunction({
        action: 'delete',
        user_id: userId,
      });
      logActivity({ client_id: target?.client_id, action: 'deleted', entity_type: 'user', entity_id: userId, entity_title: target?.full_name ?? 'User' });
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
            {inviteRole === 'admin' ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                All Clients — admins have access to all clients
              </div>
            ) : (
              <Select value={inviteClient} onValueChange={setInviteClient} disabled={!inviteRole}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
        <Button onClick={handleInvite} disabled={submitting || !inviteName || !inviteEmail || !inviteRole || (inviteRole === 'client' && !inviteClient)} className="w-full bg-foreground text-background hover:bg-foreground/90">
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
                    {!user.email_confirmed_at && (
                      <Badge className="bg-yellow-400 text-yellow-950 hover:bg-yellow-400 border-transparent text-[9px] px-1.5 py-0 h-4">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {user.role} · {user.role === 'admin' ? 'All Clients' : (user.client_name ?? '—')}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {!user.email_confirmed_at && (
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
                  <button
                    onClick={() => { setSelectedUserId(user.id); setNewPassword(''); setPasswordError(''); setPasswordSuccess(false); }}
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      padding: '4px 10px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      background: 'none',
                      color: '#666',
                      cursor: 'pointer'
                    }}
                  >
                    Set Password
                  </button>
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
              {editRole !== 'admin' && (
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
              )}
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
      {selectedUserId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '32px', width: '100%', maxWidth: '380px', borderRadius: '4px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#141414' }}>Set Password</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
              Set a temporary password for this user. They can change it after signing in.
            </p>
            {passwordError && (
              <p style={{ fontSize: '12px', color: '#E74C3C', marginBottom: '12px', padding: '8px', background: '#FEF2F2' }}>{passwordError}</p>
            )}
            {passwordSuccess ? (
              <p style={{ fontSize: '12px', color: '#2ECC71', padding: '8px', background: '#F0FFF4', textAlign: 'center' }}>✓ Password set successfully</p>
            ) : (
              <>
                <input
                  type="password"
                  placeholder="New password (min 8 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', fontSize: '13px', marginBottom: '12px', outline: 'none', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setSelectedUserId(null); setNewPassword(''); setPasswordError(''); }}
                    style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid #E5E5E5', fontSize: '12px', cursor: 'pointer', color: '#666', borderRadius: '4px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSetPassword}
                    disabled={passwordLoading || !newPassword}
                    style={{ flex: 1, padding: '10px', background: 'hsl(225,70%,35%)', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: passwordLoading || !newPassword ? 'not-allowed' : 'pointer', opacity: passwordLoading || !newPassword ? 0.6 : 1, borderRadius: '4px' }}
                  >
                    {passwordLoading ? 'Setting...' : 'Set Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Narrative Watch Form ── */
interface NarrativeRow {
  id: string;
  week_start: string;
  narrative_watch: string | null;
  client_id: string;
}

export function NarrativeWatchForm({ defaultClientId }: { defaultClientId: string | null }) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>(defaultClientId || '');
  const [weeks, setWeeks] = useState<NarrativeRow[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [narrativeText, setNarrativeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      setClients((data as ClientOption[]) || []);
    });
  }, []);

  const fetchWeeks = useCallback(async () => {
    if (!selectedClient) { setWeeks([]); return; }
    const { data, error } = await supabase
      .from('weekly_snapshots')
      .select('id, week_start, narrative_watch, client_id')
      .eq('client_id', selectedClient)
      .order('week_start', { ascending: false });
    if (error) { console.error('[NarrativeWatchForm] fetch error:', error); return; }
    setWeeks((data as NarrativeRow[]) || []);
  }, [selectedClient]);

  useEffect(() => { fetchWeeks(); }, [fetchWeeks]);

  const handlePost = async () => {
    if (!selectedClient || !selectedWeek) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('weekly_snapshots')
      .update({ narrative_watch: narrativeText || null })
      .eq('client_id', selectedClient)
      .eq('week_start', selectedWeek);
    setSubmitting(false);
    if (error) { console.error('[NarrativeWatchForm] post error:', error); return; }
    logActivity({ client_id: selectedClient, action: 'created', entity_type: 'narrative_watch', entity_title: `Narrative for ${selectedWeek}`, metadata: { week_start: selectedWeek, text: narrativeText } });
    setSuccess('Narrative posted');
    setNarrativeText('');
    setSelectedWeek('');
    fetchWeeks();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveEdit = async (row: NarrativeRow) => {
    const { error } = await supabase
      .from('weekly_snapshots')
      .update({ narrative_watch: editText || null })
      .eq('id', row.id);
    if (error) { console.error('[NarrativeWatchForm] edit error:', error); return; }
    logActivity({ client_id: row.client_id, action: 'updated', entity_type: 'narrative_watch', entity_id: row.id, entity_title: `Narrative for ${row.week_start}`, metadata: { week_start: row.week_start, text: editText } });
    setEditingId(null);
    setEditText('');
    fetchWeeks();
  };

  const handleDelete = async (row: NarrativeRow) => {
    const { error } = await supabase
      .from('weekly_snapshots')
      .update({ narrative_watch: null })
      .eq('id', row.id);
    if (error) { console.error('[NarrativeWatchForm] delete error:', error); return; }
    logActivity({ client_id: row.client_id, action: 'deleted', entity_type: 'narrative_watch', entity_id: row.id, entity_title: `Narrative for ${row.week_start}` });
    fetchWeeks();
  };

  const existing = weeks.filter(w => w.narrative_watch && w.narrative_watch.trim().length > 0);

  return (
    <div className="space-y-6">
      {success && <SuccessMessage message={success} />}
      <div className="space-y-3 border border-border rounded-lg p-4">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Post Narrative</p>
        <Field label="Client">
          <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedWeek(''); }}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Week">
          <Select value={selectedWeek} onValueChange={setSelectedWeek} disabled={!selectedClient || weeks.length === 0}>
            <SelectTrigger><SelectValue placeholder={selectedClient ? (weeks.length ? 'Select week' : 'No weeks available') : 'Select client first'} /></SelectTrigger>
            <SelectContent>
              {weeks.map(w => (
                <SelectItem key={w.id} value={w.week_start}>
                  {format(new Date(w.week_start + 'T00:00:00'), 'PP')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Narrative Text">
          <Textarea
            value={narrativeText}
            onChange={e => setNarrativeText(e.target.value)}
            placeholder="e.g. Turnaround narrative gaining traction — sentiment running 71% positive on leadership story."
            rows={4}
          />
        </Field>
        <Button
          onClick={handlePost}
          disabled={submitting || !selectedClient || !selectedWeek || !narrativeText.trim()}
          className="w-full bg-foreground text-background hover:bg-foreground/90"
        >
          {submitting ? 'Posting…' : 'Post Narrative'}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Existing Narratives</p>
        {!selectedClient ? (
          <p className="text-xs text-muted-foreground">Select a client to view narratives.</p>
        ) : existing.length === 0 ? (
          <p className="text-xs text-muted-foreground">No narratives posted for this client yet.</p>
        ) : (
          <div className="space-y-2">
            {existing.map(row => (
              <div key={row.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    {format(new Date(row.week_start + 'T00:00:00'), 'PP')}
                  </p>
                  <div className="flex items-center gap-1">
                    {editingId === row.id ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveEdit(row)} title="Save">
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(null); setEditText(''); }} title="Cancel">
                          <span className="text-xs">×</span>
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(row.id); setEditText(row.narrative_watch || ''); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Narrative</AlertDialogTitle>
                          <AlertDialogDescription>
                            Clear the narrative for week of {format(new Date(row.week_start + 'T00:00:00'), 'PP')}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(row)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {editingId === row.id ? (
                  <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} />
                ) : (
                  <p className="text-xs leading-relaxed">{row.narrative_watch}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Panel ── */
/* ── Tab Access Manager ── */
interface TabAccessClient {
  id: string;
  name: string;
  enabled_tabs: string[] | null;
}

export function TabAccessManager() {
  const [clients, setClients] = useState<TabAccessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceClientId, setSourceClientId] = useState<string>('');
  const [targetClientIds, setTargetClientIds] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [savedFlash, setSavedFlash] = useState<Record<string, number>>({});

  const flashSaved = (clientId: string, tabId: string) => {
    const key = `${clientId}:${tabId}`;
    setSavedFlash(prev => ({ ...prev, [key]: Date.now() }));
    setTimeout(() => {
      setSavedFlash(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 1800);
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, enabled_tabs')
        .order('name');
      if (error) console.error('[TabAccessManager] fetch error:', error);
      setClients((data as TabAccessClient[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const toggleTab = async (clientId: string, tabId: string, currentTabs: string[]) => {
    const newTabs = currentTabs.includes(tabId)
      ? currentTabs.filter(t => t !== tabId)
      : [...currentTabs, tabId];

    // Optimistic update
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, enabled_tabs: newTabs } : c));

    const { error, data } = await supabase
      .from('clients')
      .update({ enabled_tabs: newTabs })
      .eq('id', clientId)
      .select('id, enabled_tabs');

    if (error || !data || data.length === 0) {
      console.error('[TabAccessManager] toggle error:', error, 'returned:', data);
      toast.error(error?.message ? `Failed to save: ${error.message}` : 'Failed to save tab access (no rows updated — check permissions)');
      // Revert
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, enabled_tabs: currentTabs } : c));
      return;
    }
    flashSaved(clientId, tabId);
    toast.success('Tab access updated');
  };

  const copyTabAccess = async () => {
    if (!sourceClientId || targetClientIds.length === 0) return;
    const source = clients.find(c => c.id === sourceClientId);
    if (!source) return;
    const sourceTabs = source.enabled_tabs ?? [];

    setCopying(true);
    const { error } = await supabase
      .from('clients')
      .update({ enabled_tabs: sourceTabs })
      .in('id', targetClientIds);
    setCopying(false);

    if (error) {
      console.error('[TabAccessManager] copy error:', error);
      toast.error('Failed to copy tab access');
      return;
    }
    setClients(prev => prev.map(c =>
      targetClientIds.includes(c.id) ? { ...c, enabled_tabs: sourceTabs } : c
    ));
    toast.success(`Copied tab access from ${source.name} to ${targetClientIds.length} client(s)`);
    setSourceClientId('');
    setTargetClientIds([]);
  };

  const handleCopy = () => {
    const sourceName = clients.find(c => c.id === sourceClientId)?.name ?? '';
    if (window.confirm(`Copy tab access from ${sourceName} to ${targetClientIds.length} client(s)? This will overwrite their current tab access.`)) {
      copyTabAccess();
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground">Loading clients…</div>;

  return (
    <div className="space-y-4">
      {/* Copy Tab Access */}
      <div className="bg-white border border-black/10 p-4">
        <h4 style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'hsl(0,0%,40%)', marginBottom: '12px' }}>
          Copy Tab Access
        </h4>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Copy from</label>
            <Select value={sourceClientId} onValueChange={setSourceClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Copy to (select multiple)</label>
            <div className="border border-black/10 rounded p-2 max-h-40 overflow-y-auto">
              {clients.filter(c => c.id !== sourceClientId).map(c => (
                <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetClientIds.includes(c.id)}
                    onChange={() => {
                      setTargetClientIds(prev =>
                        prev.includes(c.id)
                          ? prev.filter(id => id !== c.id)
                          : [...prev, c.id]
                      );
                    }}
                  />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
              {clients.filter(c => c.id !== sourceClientId).length === 0 && (
                <div className="text-xs text-muted-foreground px-1 py-1">No other clients available.</div>
              )}
            </div>
          </div>
          <button
            onClick={handleCopy}
            disabled={!sourceClientId || targetClientIds.length === 0 || copying}
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '8px 16px',
              background: 'hsl(225,70%,35%)',
              color: 'white',
              cursor: (!sourceClientId || targetClientIds.length === 0 || copying) ? 'not-allowed' : 'pointer',
              opacity: (!sourceClientId || targetClientIds.length === 0 || copying) ? 0.5 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {copying ? 'Copying…' : 'Copy Access'}
          </button>
        </div>
      </div>

      {/* Per-client toggle grid */}
      <div className="bg-white border border-black/10 p-4">
        <h3 style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(0,0%,40%)', marginBottom: '16px' }}>
          Client Tab Access
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/10">
                <th className="text-left py-2 pr-3 font-mono-ui text-[10px] tracking-[0.12em] uppercase text-muted-foreground sticky left-0 bg-white">
                  Client
                </th>
                {ALL_TABS.map(tab => (
                  <th key={tab.id} className="px-2 py-2 font-mono-ui text-[9px] tracking-[0.1em] uppercase text-muted-foreground whitespace-nowrap">
                    {tab.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(client => {
                const tabs = client.enabled_tabs ?? [];
                return (
                  <tr key={client.id} className="border-b border-black/5">
                    <td className="py-2 pr-3 font-medium sticky left-0 bg-white whitespace-nowrap">{client.name}</td>
                    {ALL_TABS.map(tab => (
                      <td key={tab.id} className="px-2 py-2 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <Switch
                            checked={tabs.includes(tab.id)}
                            onCheckedChange={() => toggleTab(client.id, tab.id, tabs)}
                          />
                          {savedFlash[`${client.id}:${tab.id}`] && (
                            <span className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Saved
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel({ open, onOpenChange, clientId }: AdminPanelProps) {
  const [adminSection, setAdminSection] = useState('pipeline');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-background border-border p-0">
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
              <SelectItem value="narrative" className="text-xs tracking-wider uppercase">Narrative Watch</SelectItem>
              <SelectItem value="users" className="text-xs tracking-wider uppercase">Users</SelectItem>
              <SelectItem value="tab_access" className="text-xs tracking-wider uppercase">Tab Access</SelectItem>
            </SelectContent>
          </Select>
          {adminSection === 'pipeline' && <PipelineForm clientId={clientId} />}
          {adminSection === 'keywins' && <KeyWinsForm clientId={clientId} />}
          {adminSection === 'partnerships' && <PartnershipsForm clientId={clientId} />}
          {adminSection === 'products' && <ProductLaunchesForm clientId={clientId} />}
          {adminSection === 'placements' && <PlacementsForm clientId={clientId} />}
          {adminSection === 'snapshot' && <WeeklySnapshotForm clientId={clientId} />}
          {adminSection === 'narrative' && <NarrativeWatchForm defaultClientId={clientId} />}
          {adminSection === 'users' && <UserManagement />}
          {adminSection === 'tab_access' && <TabAccessManager />}

          {/* Manage Entries section */}
          {adminSection !== 'tab_access' && (
            <div className="border-t border-border pt-6">
              <ManageEntries clientId={clientId} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
