import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';

interface Product {
  id: string;
  product_name: string;
  launch_type: string;
  description: string;
  launch_date: string | null;
  retailers: string[];
  status: string;
}

const statusBadge: Record<string, { label: string; style: string }> = {
  active: { label: 'ACTIVE', style: 'border border-foreground/30 text-foreground' },
  upcoming: { label: 'UPCOMING', style: 'bg-corp-news' },
  'in-planning': { label: 'IN PLANNING', style: 'bg-muted text-muted-foreground' },
};

const typeBadge: Record<string, { label: string; style: string }> = {
  'hero-launch': { label: 'HERO LAUNCH', style: 'bg-foreground text-background' },
  'new-launch': { label: 'NEW LAUNCH', style: 'bg-foreground text-background' },
  reformulated: { label: 'REFORMULATED', style: 'bg-muted-foreground/80 text-background' },
  'entry-product': { label: 'ENTRY PRODUCT', style: 'bg-muted-foreground/80 text-background' },
  upcoming: { label: 'UPCOMING', style: 'bg-corp-news' },
};

const ProductLaunchesTab = () => {
  const { refreshKey } = useWeek();
  const { clientId } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('product_pipeline')
        .select('*')
        .eq('client_id', clientId)
        .order('launch_date', { ascending: true });
      if (error) console.error('[ProductLaunchesTab] error:', error);
      setProducts(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId, refreshKey]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (products.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground py-24">
        No product launches yet. Add entries via the Admin panel.
      </div>
    );
  }

  const toArray = (v: unknown): string[] =>
    Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [];

  const activeProducts = products.filter(p => p.status === 'active');
  const upcomingProducts = products.filter(p => p.status !== 'active');

  return (
    <div className="p-6 space-y-6">
      {/* Active launches */}
      {activeProducts.map((prod) => (
        <div key={prod.id} className="bg-foreground text-background p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-wide">{prod.product_name.toUpperCase()}</h3>
              <p className="text-xs opacity-70 mt-1">
                {toArray(prod.retailers).join(' + ')}{prod.launch_date ? ` · Launched ${new Date(prod.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
              </p>
              {prod.description && <p className="text-xs opacity-60 mt-1">{prod.description}</p>}
            </div>
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 border border-background/30">ACTIVE</span>
          </div>
        </div>
      ))}

      {/* Upcoming / Pipeline products */}
      {upcomingProducts.length > 0 && (
        <>
          <div className="bg-foreground text-background p-4 flex items-center justify-between">
            <span className="text-sm font-bold tracking-wider">PIPELINE</span>
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 border border-background/30">UPCOMING</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {upcomingProducts.map((prod) => {
              const tBadge = typeBadge[prod.launch_type] ?? { label: prod.launch_type?.toUpperCase() ?? '', style: 'bg-muted text-muted-foreground' };
              const sBadge = statusBadge[prod.status] ?? { label: prod.status?.toUpperCase() ?? '', style: 'bg-muted text-muted-foreground' };
              return (
                <div key={prod.id} className="bg-card border border-border p-5">
                  <h4 className="text-sm font-bold text-foreground mb-2">{prod.product_name.toUpperCase()}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    {prod.description}
                  </p>
                  {toArray(prod.retailers).length > 0 && (
                    <p className="text-[11px] text-muted-foreground mb-2">Retailers: {toArray(prod.retailers).join(', ')}</p>
                  )}
                  {prod.launch_date && (
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Launch: {new Date(prod.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 ${tBadge.style}`}>{tBadge.label}</span>
                    <span className={`text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 ${sBadge.style}`}>{sBadge.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductLaunchesTab;
