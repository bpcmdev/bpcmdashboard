import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';
import { useWeek } from '@/contexts/WeekContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineEntry {
  id: string;
  title: string;
  event_date: string | null;
  event_type: string;
  description: string;
  monitor_strings: string[];
  priority: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function EditPipelineDialog({ entry }: { entry: PipelineEntry }) {
  const { refreshData } = useWeek();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState(entry.title);
  const [eventDate, setEventDate] = useState<Date | undefined>(entry.event_date ? new Date(entry.event_date + 'T00:00:00') : undefined);
  const [eventType, setEventType] = useState(entry.event_type);
  const [description, setDescription] = useState(entry.description || '');
  const [monitorStrings, setMonitorStrings] = useState(entry.monitor_strings?.join(', ') || '');
  const [priority, setPriority] = useState(entry.priority || '');

  const resetForm = () => {
    setTitle(entry.title);
    setEventDate(entry.event_date ? new Date(entry.event_date + 'T00:00:00') : undefined);
    setEventType(entry.event_type);
    setDescription(entry.description || '');
    setMonitorStrings(entry.monitor_strings?.join(', ') || '');
    setPriority(entry.priority || '');
    setConfirming(false);
  };

  const handleSave = async () => {
    setSubmitting(true);
    const payload = {
      title,
      event_date: eventDate ? format(eventDate, 'yyyy-MM-dd') : null,
      event_type: eventType,
      description,
      monitor_strings: monitorStrings ? monitorStrings.split(',').map(s => s.trim()).filter(Boolean) : [],
      priority,
    };
    console.log('[EditPipeline] update payload:', payload);
    const { error } = await supabase.from('pipeline_moments').update(payload).eq('id', entry.id);
    if (error) console.error('[EditPipeline] update error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ action: 'updated', entity_type: 'pipeline_moment', entity_id: entry.id, entity_title: title, metadata: { event_type: eventType, priority } });
      setOpen(false);
      setConfirming(false);
      refreshData();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetForm(); } }}>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold tracking-widest uppercase">Edit Pipeline Moment</DialogTitle>
        </DialogHeader>
        {confirming ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Are you sure you want to save these changes?</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting}>{submitting ? 'Saving…' : 'Confirm'}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <Field label="Event Title"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
            <Field label="Event Date">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {eventDate ? format(eventDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </Field>
            <Field label="Event Type">
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{['launch', 'event', 'corp-comms', 'milestone', 'moment', 'retail'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
            <Field label="Monitor Strings"><Input value={monitorStrings} onChange={e => setMonitorStrings(e.target.value)} placeholder="Comma separated" /></Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>{['active', 'watch', 'upcoming'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Button onClick={() => setConfirming(true)} disabled={!title} className="w-full bg-foreground text-background hover:bg-foreground/90">Save Changes</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
