import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import PlaceholderCard from './PlaceholderCard';
import DeleteEntryButton from './DeleteEntryButton';
import EditProductDialog from './EditProductDialog';

interface Product {
  id: string;
  product_name: string;
  launch_type: string;
  description: string;
  launch_date: string | null;
  retailers: unknown;
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

const toArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    // Handle JSON-encoded arrays like '["Sephora","Ulta"]'
    if (v.startsWith('[')) {
      try { return JSON.parse(v); } catch { /* fall through */ }
    }
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const ProductLaunchesTab = () => {
  const { refreshKey } = useWeek();
  const { clientId, isAdmin } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      setLoading(true);
      setError(false);
      const { data, error: err } = await supabase
        .from('product_pipeline')
        .select('*')
        .eq('client_id', clientId)
        .order('launch_date', { ascending: true });
      if (err) {
        console.error('[ProductLaunchesTab] error:', err);
        setError(true);
      }
      setProducts(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId, refreshKey]);

  const activeProducts = products.filter(p => p.status === 'active');
  const upcomingProducts = products.filter(p => p.status !== 'active');
  const upcomingPlaceholders = Math.max(0, 3 - upcomingProducts.length);

  return (
    <DataStateWrapper loading={loading} error={error}>
      {products.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground py-24">
          No product launches yet. Add entries via the Admin panel.
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {activeProducts.map((prod) => (
            <div key={prod.id} className="bg-foreground text-background p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-wide">{prod.product_name.toUpperCase()}</h3>
                  <p className="text-xs opacity-70 mt-1">
                    {toArray(prod.retailers).join(', ')}{prod.launch_date ? ` · Launched ${new Date(prod.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                  </p>
                  {prod.description && <p className="text-xs opacity-60 mt-1">{prod.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 border border-background/30">ACTIVE</span>
                  {isAdmin && <EditProductDialog entry={prod} />}
                  {isAdmin && <DeleteEntryButton table="product_pipeline" id={prod.id} label="this product" />}
                </div>
              </div>
            </div>
          ))}

          {(upcomingProducts.length > 0 || upcomingPlaceholders > 0) && (
            <>
              <div className="bg-foreground text-background p-4 flex items-center justify-between">
                <span className="text-sm font-bold tracking-wider">PIPELINE</span>
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 border border-background/30">UPCOMING</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {upcomingProducts.map((prod) => {
                  const tBadge = typeBadge[prod.launch_type] ?? { label: prod.launch_type?.toUpperCase() ?? '', style: 'bg-muted text-muted-foreground' };
                  const sBadge = statusBadge[prod.status] ?? { label: prod.status?.toUpperCase() ?? '', style: 'bg-muted text-muted-foreground' };
                  const retailers = toArray(prod.retailers);
                  return (
                    <div key={prod.id} className="bg-card border border-border p-5 relative">
                      {isAdmin && <div className="absolute top-3 right-3 flex items-center gap-1"><EditProductDialog entry={prod} /><DeleteEntryButton table="product_pipeline" id={prod.id} label="this product" /></div>}
                      <h4 className="text-sm font-bold text-foreground mb-2">{prod.product_name.toUpperCase()}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{prod.description}</p>
                      {retailers.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mb-2">Retailers: {retailers.join(', ')}</p>
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
                {Array.from({ length: upcomingPlaceholders }).map((_, i) => (
                  <PlaceholderCard key={`ph-${i}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </DataStateWrapper>
  );
};

export default ProductLaunchesTab;
