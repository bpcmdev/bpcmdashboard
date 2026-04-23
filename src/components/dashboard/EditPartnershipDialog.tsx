import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';
import { useWeek } from '@/contexts/WeekContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Partnership {
  id: string;
  partner_name: string;
  type: string;
  status: string;
  description: string;
  emv_generated: number | null;
  notes: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function EditPartnershipDialog({ entry }: { entry: Partnership }) {
  const { refreshData } = useWeek();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [partnerName, setPartnerName] = useState(entry.partner_name);
  const [type, setType] = useState(entry.type || '');
  const [status, setStatus] = useState(entry.status || '');
  const [description, setDescription] = useState(entry.description || '');
  const [emv, setEmv] = useState(entry.emv_generated?.toString() || '');
  const [notes, setNotes] = useState(entry.notes || '');

  const resetForm = () => {
    setPartnerName(entry.partner_name);
    setType(entry.type || '');
    setStatus(entry.status || '');
    setDescription(entry.description || '');
    setEmv(entry.emv_generated?.toString() || '');
    setNotes(entry.notes || '');
    setConfirming(false);
  };

  const handleSave = async () => {
    setSubmitting(true);
    const payload = { partner_name: partnerName, type, status, description, emv_generated: emv ? Number(emv) : null, notes };
    console.log('[EditPartnership] update payload:', payload);
    const { error } = await supabase.from('partnerships').update(payload).eq('id', entry.id);
    if (error) console.error('[EditPartnership] update error:', error);
    setSubmitting(false);
    if (!error) {
      logActivity({ action: 'updated', entity_type: 'partnership', entity_id: entry.id, entity_title: partnerName, metadata: { type, status } });
      setOpen(false); setConfirming(false); refreshData();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold tracking-widest uppercase">Edit Partnership</DialogTitle>
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
            <Field label="Partner Name"><Input value={partnerName} onChange={e => setPartnerName(e.target.value)} /></Field>
            <Field label="Type"><Input value={type} onChange={e => setType(e.target.value)} placeholder="e.g. Retail, Creative, Collab" /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{['live', 'in-development', 'past'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
            <Field label="EMV Generated"><Input type="number" value={emv} onChange={e => setEmv(e.target.value)} placeholder="0" /></Field>
            <Field label="Notes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field>
            <Button onClick={() => setConfirming(true)} disabled={!partnerName} className="w-full bg-foreground text-background hover:bg-foreground/90">Save Changes</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
