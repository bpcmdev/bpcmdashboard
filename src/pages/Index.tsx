import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek, WeekProvider } from '@/contexts/WeekContext';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import NarrativeTicker from '@/components/dashboard/NarrativeTicker';
import KpiBar from '@/components/dashboard/KpiBar';
import TabNavigation from '@/components/dashboard/TabNavigation';
import EarnedMediaTab from '@/components/dashboard/EarnedMediaTab';
import KeyWinsTab from '@/components/dashboard/KeyWinsTab';
import ProductLaunchesTab from '@/components/dashboard/ProductLaunchesTab';
import PipelineMomentsTab from '@/components/dashboard/PipelineMomentsTab';
import InfluencerSocialTab from '@/components/dashboard/InfluencerSocialTab';
import CorporateCommsTab from '@/components/dashboard/CorporateCommsTab';
import AIVisibilityTab from '@/components/dashboard/AIVisibilityTab';
import GeoAISovTab from '@/components/dashboard/GeoAISovTab';
import PartnershipsTab from '@/components/dashboard/PartnershipsTab';
import TikTokShopTab from '@/components/dashboard/TikTokShopTab';
import ResourceManagementTab from '@/components/dashboard/ResourceManagementTab';
import AtAGlanceTab from '@/components/dashboard/AtAGlanceTab';
import ProductIntelligenceTab from '@/components/dashboard/ProductIntelligenceTab';
import WholesaleRetailTab from '@/components/dashboard/WholesaleRetailTab';
import GettingStarted, { useIsNewClient } from '@/components/dashboard/GettingStarted';
import NotableThisWeek from '@/components/dashboard/NotableThisWeek';
import { LinkPreviewProvider } from '@/components/dashboard/LinkPreviewDrawer';
import { exportDashboardPdf } from '@/lib/exportPdf';
import { toast } from '@/hooks/use-toast';

const TAB_MAP: Record<string, React.ComponentType> = {
  'AT A GLANCE': AtAGlanceTab,
  'PRODUCT INTELLIGENCE': ProductIntelligenceTab,
  'KEY WINS': KeyWinsTab,
  'PRODUCT LAUNCHES': ProductLaunchesTab,
  'PIPELINE & MOMENTS': PipelineMomentsTab,
  'EARNED MEDIA': EarnedMediaTab,
  'INFLUENCER & SOCIAL': InfluencerSocialTab,
  'CORPORATE COMMS': CorporateCommsTab,
  'AI VISIBILITY': AIVisibilityTab,
  'GEO / AI SOV': GeoAISovTab,
  'PARTNERSHIPS': PartnershipsTab,
  'WHOLESALE / RETAIL': WholesaleRetailTab,
  'TIKTOK SHOP': TikTokShopTab,
  'RESOURCE MANAGEMENT': ResourceManagementTab,
};

/** Inner component that can access WeekContext */
function DashboardContent() {
  const [activeTab, setActiveTab] = useState('EARNED MEDIA');
  const { clientColor, clientId, isAdmin, enabledTabs, clientName } = useAdmin();
  const { activeClientId, selectedWeek, isAllTime, weeks } = useWeek();
  const { isNew } = useIsNewClient();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const TabContent = TAB_MAP[activeTab];

  // --- PDF export state ---
  const kpiRef = useRef<HTMLDivElement | null>(null);
  const exportTabHostRef = useRef<HTMLDivElement | null>(null);
  const [exportTabLabel, setExportTabLabel] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const exportResolverRef = useRef<(() => void) | null>(null);

  // Mark the offscreen tab as "ready" after it mounts; renderTab promise resolves after a settle delay.
  useEffect(() => {
    if (!exportTabLabel || !exportResolverRef.current) return;
    const t = setTimeout(() => {
      exportResolverRef.current?.();
      exportResolverRef.current = null;
    }, 2000); // allow data fetches + chart animations to settle
    return () => clearTimeout(t);
  }, [exportTabLabel]);

  const openAdmin = () => window.dispatchEvent(new CustomEvent('bpcm:open-admin-panel'));

  // Reset dismissal when client changes so a fresh new client sees the welcome.
  useEffect(() => {
    setDismissedFor(null);
  }, [activeClientId]);

  // Listen for KPI cards / external triggers asking us to switch tab.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && TAB_MAP[detail]) setActiveTab(detail);
    };
    window.addEventListener('bpcm:switch-tab', handler);
    return () => window.removeEventListener('bpcm:switch-tab', handler);
  }, []);

  // Export PDF handler — listens for header button event.
  const runExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportMsg('Preparing export…');
    try {
      const weekLabel = isAllTime
        ? 'All Time'
        : (weeks.find((w) => w.weekStart === selectedWeek)?.label ?? selectedWeek ?? '');
      await exportDashboardPdf({
        brand: {
          clientName: clientName ?? 'Client',
          weekLabel,
          primaryColor: clientColor || 'hsl(225 70% 35%)',
        },
        kpiEl: kpiRef.current,
        renderTab: (label) =>
          new Promise<HTMLElement | null>((resolve) => {
            setExportTabLabel(label);
            exportResolverRef.current = () => resolve(exportTabHostRef.current);
          }),
        onProgress: (_p, msg) => setExportMsg(msg),
      });
      toast({ title: 'PDF exported', description: 'Your dashboard report has been downloaded.' });
    } catch (e) {
      console.error('[ExportPDF] failed', e);
      toast({ title: 'Export failed', description: 'Could not generate PDF. See console.', variant: 'destructive' });
    } finally {
      setExporting(false);
      setExportTabLabel(null);
      setExportMsg('');
    }
  }, [exporting, isAllTime, weeks, selectedWeek, clientName, clientColor]);

  useEffect(() => {
    const handler = () => runExport();
    window.addEventListener('bpcm:export-pdf', handler);
    return () => window.removeEventListener('bpcm:export-pdf', handler);
  }, [runExport]);

  // If the current tab is not enabled for this (non-admin) client, fall back to
  // the first enabled tab so users never land on a hidden tab.
  useEffect(() => {
    if (isAdmin) return;
    if (!Array.isArray(enabledTabs)) return;
    const labels = Object.keys(TAB_MAP);
    const enabledLabels = labels.filter((label) => {
      const idMap: Record<string, string> = {
        'AT A GLANCE': 'at_a_glance',
        'PRODUCT INTELLIGENCE': 'product_intelligence',
        'PIPELINE & MOMENTS': 'pipeline',
        'KEY WINS': 'key_wins',
        'PRODUCT LAUNCHES': 'product_launches',
        'EARNED MEDIA': 'earned_media',
        'INFLUENCER & SOCIAL': 'influencer_social',
        'CORPORATE COMMS': 'corporate_comms',
        'AI VISIBILITY': 'ai_visibility',
        'GEO / AI SOV': 'geo_ai_sov',
        'PARTNERSHIPS': 'partnerships',
        'WHOLESALE / RETAIL': 'wholesale_retail',
        'TIKTOK SHOP': 'tiktok_shop',
        'RESOURCE MANAGEMENT': 'resource_management',
      };
      return enabledTabs.includes(idMap[label]);
    });
    if (!enabledLabels.includes(activeTab) && enabledLabels.length > 0) {
      setActiveTab(enabledLabels[0]);
    }
  }, [enabledTabs, isAdmin, activeTab]);

  // Getting Started checklist is an internal BPCM setup task — admins only.
  const showWelcome = isAdmin && isNew === true && dismissedFor !== activeClientId;

  const ExportTabComp = exportTabLabel ? TAB_MAP[exportTabLabel] : null;

  return (
    <div
      className="min-h-screen bg-background"
      style={clientColor ? { '--client-accent': clientColor } as React.CSSProperties : undefined}
    >
      <DashboardHeader />
      {!showWelcome && <NarrativeTicker />}
      {!showWelcome && <NotableThisWeek />}
      {!showWelcome && (
        <div ref={kpiRef}>
          <KpiBar />
        </div>
      )}
      {!showWelcome && <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} enabledTabs={enabledTabs} isAdmin={isAdmin} />}
      {showWelcome ? (
        <GettingStarted
          onDismiss={() => setDismissedFor(activeClientId)}
          onJumpToTab={(tab) => { setActiveTab(tab); setDismissedFor(activeClientId); }}
          onOpenAdmin={openAdmin}
        />
      ) : TabContent ? (
        <div key={activeTab} className="tab-content-enter">
          <TabContent />
        </div>
      ) : (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          {activeTab} — Coming soon
        </div>
      )}

      {/* Offscreen export host: mounts one tab at a time at desktop width for clean capture */}
      {exporting && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: -100000,
            top: 0,
            width: 1600,
            background: '#fff',
            pointerEvents: 'none',
          }}
        >
          <div ref={exportTabHostRef} style={{ width: 1600, padding: '0 32px', background: '#fff' }}>
            {ExportTabComp ? <ExportTabComp /> : null}
          </div>
        </div>
      )}

      {/* Export overlay */}
      {exporting && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center">
          <div className="bg-white rounded-md px-6 py-5 shadow-xl text-center min-w-[280px]">
            <div className="text-sm font-semibold tracking-wider uppercase mb-2">Generating PDF</div>
            <div className="text-xs text-muted-foreground">{exportMsg || 'Working…'}</div>
            <div className="mt-3 h-1 bg-black/10 rounded overflow-hidden">
              <div className="h-full bg-foreground animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Index = () => {
  const { loading } = useAuth(true);

  if (loading) return <div className="min-h-screen bg-background" />;

  return (
    <WeekProvider>
      <LinkPreviewProvider>
        <DashboardContent />
      </LinkPreviewProvider>
    </WeekProvider>
  );
};

export default Index;
