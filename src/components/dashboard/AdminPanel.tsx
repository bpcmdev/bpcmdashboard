import { useState } from 'react';
import { format } from 'date-fns';
import { useWeek } from '@/contexts/WeekContext';
import { supabase } from '@/lib/supabase';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <Field label="Narrative Watch"><Textarea value={narrativeWatch} onChange={e => setNarrativeWatch(e.target.value)} placeholder="Key narrative to watch this week…" /></Field>
      <Button onClick={handleSubmit} disabled={submitting || !weekStart} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {submitting ? 'Submitting…' : 'Add Weekly Snapshot'}
      </Button>
    </div>
  );
}

/* ── Main Panel ── */
export default function AdminPanel({ open, onOpenChange, clientId }: AdminPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-background border-border p-0">
        <div className="bg-foreground text-background px-6 py-4">
          <SheetTitle className="text-background text-sm font-bold tracking-widest uppercase">Admin Data Entry</SheetTitle>
        </div>
        <div className="p-6">
          <Tabs defaultValue="pipeline" className="w-full">
            <TabsList className="w-full grid grid-cols-5 bg-muted">
              <TabsTrigger value="pipeline" className="text-[10px] tracking-wider uppercase">Pipeline</TabsTrigger>
              <TabsTrigger value="keywins" className="text-[10px] tracking-wider uppercase">Key Wins</TabsTrigger>
              <TabsTrigger value="partnerships" className="text-[10px] tracking-wider uppercase">Partners</TabsTrigger>
              <TabsTrigger value="products" className="text-[10px] tracking-wider uppercase">Products</TabsTrigger>
              <TabsTrigger value="snapshot" className="text-[10px] tracking-wider uppercase">Snapshot</TabsTrigger>
            </TabsList>
            <TabsContent value="pipeline" className="mt-6"><PipelineForm clientId={clientId} /></TabsContent>
            <TabsContent value="keywins" className="mt-6"><KeyWinsForm clientId={clientId} /></TabsContent>
            <TabsContent value="partnerships" className="mt-6"><PartnershipsForm clientId={clientId} /></TabsContent>
            <TabsContent value="products" className="mt-6"><ProductLaunchesForm clientId={clientId} /></TabsContent>
            <TabsContent value="snapshot" className="mt-6"><WeeklySnapshotForm clientId={clientId} /></TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
