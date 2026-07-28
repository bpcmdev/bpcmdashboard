import { useState, useEffect } from 'react';
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
import InfluencerIntelligenceTab from '@/components/dashboard/InfluencerIntelligenceTab';

import AIVisibilityTab from '@/components/dashboard/AIVisibilityTab';

import TikTokShopTab from '@/components/dashboard/TikTokShopTab';
import ResourceManagementTab from '@/components/dashboard/ResourceManagementTab';
import AtAGlanceTab from '@/components/dashboard/AtAGlanceTab';
import ProductIntelligenceTab from '@/components/dashboard/ProductIntelligenceTab';
import WholesaleRetailTab from '@/components/dashboard/WholesaleRetailTab';
import { SetupBanner, useIsNewClient } from '@/components/dashboard/GettingStarted';
import NotableThisWeek from '@/components/dashboard/NotableThisWeek';
import { LinkPreviewProvider } from '@/components/dashboard/LinkPreviewDrawer';

const TAB_MAP: Record<string, React.ComponentType> = {
  'AT A GLANCE': AtAGlanceTab,
  'PRODUCT INTELLIGENCE': ProductIntelligenceTab,
  'KEY WINS': KeyWinsTab,
  'PRODUCT LAUNCHES': ProductLaunchesTab,
  'PIPELINE & MOMENTS': PipelineMomentsTab,
  'EARNED MEDIA': EarnedMediaTab,
  'INFLUENCER INTELLIGENCE': InfluencerIntelligenceTab,
  'INFLUENCER & SOCIAL': InfluencerIntelligenceTab,

  'AI VISIBILITY': AIVisibilityTab,
  'PARTNERSHIPS': InfluencerIntelligenceTab,
  'WHOLESALE / RETAIL': WholesaleRetailTab,
  'TIKTOK SHOP': TikTokShopTab,
  'RESOURCE MANAGEMENT': ResourceManagementTab,
};

/** Inner component that can access WeekContext */
function DashboardContent() {
  const [activeTab, setActiveTab] = useState('AT A GLANCE');
  const { clientColor, isAdmin, enabledTabs } = useAdmin();
  const { activeClientId } = useWeek();
  const { isNew, checklist } = useIsNewClient();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const TabContent = TAB_MAP[activeTab];

  const openAdmin = () => window.dispatchEvent(new CustomEvent('bpcm:open-admin-panel'));

  // Reset dismissal when client changes so a fresh new client sees the banner.
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
        'INFLUENCER INTELLIGENCE': 'influencer_social',
        'INFLUENCER & SOCIAL': 'influencer_social',
        'CORPORATE COMMS': 'corporate_comms',
        'AI VISIBILITY': 'ai_visibility',
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

  const showSetupBanner = isAdmin && isNew === true && dismissedFor !== activeClientId && !!checklist;

  return (
    <div
      className="min-h-screen bg-background"
      style={clientColor ? { '--client-accent': clientColor } as React.CSSProperties : undefined}
    >
      <DashboardHeader />
      {showSetupBanner && checklist && (
        <SetupBanner
          checklist={checklist}
          onJumpToTab={(tab) => setActiveTab(tab)}
          onOpenAdmin={openAdmin}
          onDismiss={() => setDismissedFor(activeClientId)}
        />
      )}
      <NarrativeTicker />
      <NotableThisWeek />
      <KpiBar />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} enabledTabs={enabledTabs} isAdmin={isAdmin} />
      {TabContent ? (
        <div key={activeTab} className="tab-content-enter">
          <TabContent />
        </div>
      ) : (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          {activeTab} — Coming soon
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
