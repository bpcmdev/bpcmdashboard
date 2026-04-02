import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, CalendarIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  product_name: string;
  launch_type: string;
  description: string;
  launch_date: string | null;
  retailers: unknown;
  status: string;
}

const toArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    if (v.startsWith('[')) { try { return JSON.parse(v); } catch { /* fall through */ } }
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function EditProductDialog({ entry }: { entry: Product }) {
  const { refreshData } = useWeek();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [productName, setProductName] = useState(entry.product_name);
  const [launchType, setLaunchType] = useState(entry.launch_type || '');
  const [description, setDescription] = useState(entry.description || '');
  const [launchDate, setLaunchDate] = useState<Date | undefined>(entry.launch_date ? new Date(entry.launch_date + 'T00:00:00') : undefined);
  const [retailers, setRetailers] = useState(toArray(entry.retailers).join(', '));
  const [status, setStatus] = useState(entry.status || '');

  const resetForm = () => {
    setProductName(entry.product_name);
    setLaunchType(entry.launch_type || '');
    setDescription(entry.description || '');
    setLaunchDate(entry.launch_date ? new Date(entry.launch_date + 'T00:00:00') : undefined);
    setRetailers(toArray(entry.retailers).join(', '));
    setStatus(entry.status || '');
    setConfirming(false);
  };

  const handleSave = async () => {
    setSubmitting(true);
    const payload = {
      product_name: productName,
      launch_type: launchType,
      description,
      launch_date: launchDate ? format(launchDate, 'yyyy-MM-dd') : null,
      retailers: retailers ? retailers.split(',').map(s => s.trim()).filter(Boolean) : [],
      status,
    };
    console.log('[EditProduct] update payload:', payload);
    const { error } = await supabase.from('product_pipeline').update(payload).eq('id', entry.id);
    if (error) console.error('[EditProduct] update error:', error);
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
          <DialogTitle className="text-sm font-bold tracking-widest uppercase">Edit Product Launch</DialogTitle>
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
            <Field label="Product Name"><Input value={productName} onChange={e => setProductName(e.target.value)} /></Field>
            <Field label="Launch Type">
              <Select value={launchType} onValueChange={setLaunchType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{['new-launch', 'hero-launch', 'reformulated', 'entry-product', 'upcoming'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
            <Field label="Launch Date">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !launchDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {launchDate ? format(launchDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={launchDate} onSelect={setLaunchDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </Field>
            <Field label="Retailers"><Input value={retailers} onChange={e => setRetailers(e.target.value)} placeholder="Comma separated" /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{['active', 'upcoming', 'in-planning'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Button onClick={() => setConfirming(true)} disabled={!productName} className="w-full bg-foreground text-background hover:bg-foreground/90">Save Changes</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
