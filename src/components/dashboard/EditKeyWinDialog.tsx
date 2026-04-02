import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface KeyWin {
  id: string;
  title: string;
  category: string;
  description: string;
  reach: string;
  tier: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function EditKeyWinDialog({ entry }: { entry: KeyWin }) {
  const { refreshData } = useWeek();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState(entry.category || '');
  const [description, setDescription] = useState(entry.description || '');
  const [reach, setReach] = useState(entry.reach || '');
  const [tier, setTier] = useState(entry.tier || '');

  const resetForm = () => {
    setTitle(entry.title);
    setCategory(entry.category || '');
    setDescription(entry.description || '');
    setReach(entry.reach || '');
    setTier(entry.tier || '');
    setConfirming(false);
  };

  const handleSave = async () => {
    setSubmitting(true);
    const payload = { title, category, description, reach, tier };
    console.log('[EditKeyWin] update payload:', payload);
    const { error } = await supabase.from('key_wins').update(payload).eq('id', entry.id);
    if (error) console.error('[EditKeyWin] update error:', error);
    setSubmitting(false);
    if (!error) { setOpen(false); setConfirming(false); refreshData(); }
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
          <DialogTitle className="text-sm font-bold tracking-widest uppercase">Edit Key Win</DialogTitle>
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
            <Field label="Win Title"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{['Corporate Comms', 'Earned Media', 'Influencer & Social', 'Brand Partnership'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
            <Field label="Reach"><Input value={reach} onChange={e => setReach(e.target.value)} placeholder="e.g. 5.7M" /></Field>
            <Field label="Tier">
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                <SelectContent>{['Tier 1', 'Tier 2', 'Organic'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Button onClick={() => setConfirming(true)} disabled={!title} className="w-full bg-foreground text-background hover:bg-foreground/90">Save Changes</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
