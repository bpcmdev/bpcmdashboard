import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { WeekProvider, useWeek, ALL_TIME_VALUE } from '@/contexts/WeekContext';
import { LinkPreviewProvider } from '@/components/dashboard/LinkPreviewDrawer';
import { supabase } from '@/lib/supabase';

import KpiBar from '@/components/dashboard/KpiBar';
import AtAGlanceTab from '@/components/dashboard/AtAGlanceTab';
import ProductIntelligenceTab from '@/components/dashboard/ProductIntelligenceTab';
import KeyWinsTab from '@/components/dashboard/KeyWinsTab';
import ProductLaunchesTab from '@/components/dashboard/ProductLaunchesTab';
import PipelineMomentsTab from '@/components/dashboard/PipelineMomentsTab';
import EarnedMediaTab from '@/components/dashboard/EarnedMediaTab';
import InfluencerSocialTab from '@/components/dashboard/InfluencerSocialTab';

import AIVisibilityTab from '@/components/dashboard/AIVisibilityTab';

import PartnershipsTab from '@/components/dashboard/PartnershipsTab';
import WholesaleRetailTab from '@/components/dashboard/WholesaleRetailTab';
import TikTokShopTab from '@/components/dashboard/TikTokShopTab';
import ResourceManagementTab from '@/components/dashboard/ResourceManagementTab';

const SECTIONS: { id: string; label: string; Component: React.ComponentType }[] = [
  { id: 'at_a_glance', label: 'At a Glance', Component: AtAGlanceTab },
  { id: 'product_intelligence', label: 'Product Intelligence', Component: ProductIntelligenceTab },
  { id: 'pipeline', label: 'Pipeline & Moments', Component: PipelineMomentsTab },
  { id: 'key_wins', label: 'Key Wins', Component: KeyWinsTab },
  { id: 'product_launches', label: 'Product Launches', Component: ProductLaunchesTab },
  { id: 'earned_media', label: 'Earned Media', Component: EarnedMediaTab },
  { id: 'influencer_social', label: 'Influencer & Social', Component: InfluencerSocialTab },
  { id: 'corporate_comms', label: 'Corporate Comms', Component: CorporateCommsTab },
  { id: 'ai_visibility', label: 'AI Visibility', Component: AIVisibilityTab },
  
  { id: 'partnerships', label: 'Partnerships', Component: PartnershipsTab },
  { id: 'wholesale_retail', label: 'Wholesale / Retail', Component: WholesaleRetailTab },
  { id: 'tiktok_shop', label: 'TikTok Shop', Component: TikTokShopTab },
  { id: 'resource_management', label: 'Resource Management', Component: ResourceManagementTab },
];

const PRINT_CSS = `
@media screen {
  .report-shell { background: #f5f5f5; }
  .report-page  { background: #fff; margin: 16px auto; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
}
.report-page { width: 1180px; padding: 24px 28px; box-sizing: border-box; }
.report-section { break-inside: avoid; page-break-inside: avoid; }
.report-section + .report-section { break-before: page; page-break-before: always; }
.report-section h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; margin: 0 0 16px; letter-spacing: -0.01em; }
.report-empty { font-size: 12px; color: #666; padding: 8px 0; }

.report-page .recharts-responsive-container,
.report-page .recharts-wrapper { width: 1000px !important; height: 320px !important; }
.report-page .recharts-surface { width: 1000px !important; height: 320px !important; }

/* Avoid breaking common atoms across pages */
.report-page .entry-card,
.report-page [class*="rounded-"],
.report-page table tr,
.report-page .recharts-wrapper { break-inside: avoid; page-break-inside: avoid; }

@media print {
  @page { size: landscape; margin: 12mm; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
  .no-print { display: none !important; }
  .report-shell { background: #fff !important; }
  .report-page  { box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 0 !important; }
  .report-section { break-inside: avoid; page-break-inside: avoid; }
  .report-section + .report-section { break-before: page; page-break-before: always; }
}
`;

function ReportContent({ clientId, rangeParam }: { clientId: string; rangeParam: string | null }) {
  const { setOverrideClientId, setSelectedWeek, setRangeMode, setRangeFrom, setRangeTo } = useWeek();
  const [clientName, setClientName] = useState<string>('');
  const [ready, setReady] = useState(false);

  // Apply route params to WeekContext
  useEffect(() => {
    setOverrideClientId(clientId);
    if (!rangeParam || rangeParam === 'all-time') {
      setRangeMode('week');
      setSelectedWeek(ALL_TIME_VALUE);
    } else if (rangeParam.includes(':')) {
      const [from, to] = rangeParam.split(':');
      setRangeMode('range');
      setRangeFrom(from);
      setRangeTo(to);
    } else {
      setRangeMode('week');
      setSelectedWeek(rangeParam);
    }
  }, [clientId, rangeParam, setOverrideClientId, setSelectedWeek, setRangeMode, setRangeFrom, setRangeTo]);

  // Fetch client name for header
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
      setClientName(data?.name ?? '');
    })();
  }, [clientId]);

  // Pragmatic readiness gate: wait for all tabs' async queries to settle.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 6000);
    return () => clearTimeout(t);
  }, [clientId, rangeParam]);

  // Auto-trigger print once content is ready (when ?autoprint=1)
  const autoprint = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autoprint') === '1';
  useEffect(() => {
    if (!ready || !autoprint) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [ready, autoprint]);

  const rangeLabel = useMemo(() => {
    if (!rangeParam || rangeParam === 'all-time') return 'All Time';
    if (rangeParam.includes(':')) return rangeParam.replace(':', ' → ');
    return rangeParam;
  }, [rangeParam]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-sm uppercase tracking-widest mb-2">Loading report</div>
          <div className="text-xs text-muted-foreground">Fetching all sections…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-shell min-h-screen">
      <style>{PRINT_CSS}</style>

      <div className="no-print sticky top-0 z-50 bg-white border-b border-black/10 px-6 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Intelligence Report</div>
          <div className="text-sm font-semibold">{clientName} · {rangeLabel}</div>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-foreground text-background text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
        >
          Download PDF
        </button>
      </div>

      <div className="report-page">
        {/* Executive Summary */}
        <section className="report-section">
          <h2>Executive Summary</h2>
          <div className="text-xs text-muted-foreground mb-4">{clientName} · {rangeLabel}</div>
          <KpiBar />
        </section>

        {SECTIONS.map(({ id, label, Component }) => (
          <section key={id} className="report-section">
            <h2>{label}</h2>
            <Component />
          </section>
        ))}
      </div>
    </div>
  );
}

const Report = () => {
  const { loading } = useAuth(true);
  const { clientId } = useParams<{ clientId: string }>();
  const [searchParams] = useSearchParams();
  const rangeParam = searchParams.get('range');

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!clientId) return <div className="p-6 text-sm">Missing client id.</div>;

  return (
    <WeekProvider>
      <LinkPreviewProvider>
        <ReportContent clientId={clientId} rangeParam={rangeParam} />
      </LinkPreviewProvider>
    </WeekProvider>
  );
};

export default Report;
