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
import InfluencerSocialTab from '@/components/dashboard/InfluencerSocialTab';
import CorporateCommsTab from '@/components/dashboard/CorporateCommsTab';
import AIVisibilityTab from '@/components/dashboard/AIVisibilityTab';
import GeoAISovTab from '@/components/dashboard/GeoAISovTab';
import PartnershipsTab from '@/components/dashboard/PartnershipsTab';
import TikTokShopTab from '@/components/dashboard/TikTokShopTab';
import GettingStarted, { useIsNewClient } from '@/components/dashboard/GettingStarted';

const TAB_MAP: Record<string, React.ComponentType> = {
  'KEY WINS': KeyWinsTab,
  'PRODUCT LAUNCHES': ProductLaunchesTab,
  'PIPELINE & MOMENTS': PipelineMomentsTab,
  'EARNED MEDIA': EarnedMediaTab,
  'INFLUENCER & SOCIAL': InfluencerSocialTab,
  'CORPORATE COMMS': CorporateCommsTab,
  'AI VISIBILITY': AIVisibilityTab,
  'GEO / AI SOV': GeoAISovTab,
  'PARTNERSHIPS': PartnershipsTab,
  'TIKTOK SHOP': TikTokShopTab,
};

/** Inner component that can access WeekContext */
function DashboardContent() {
  const [activeTab, setActiveTab] = useState('EARNED MEDIA');
  const { clientColor, clientId, isAdmin } = useAdmin();
  const { activeClientId } = useWeek();
  const { isNew } = useIsNewClient();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const TabContent = TAB_MAP[activeTab];

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

  // Getting Started checklist is an internal BPCM setup task — admins only.
  const showWelcome = isAdmin && isNew === true && dismissedFor !== activeClientId;

  return (
    <div
      className="min-h-screen bg-background"
      style={clientColor ? { '--client-accent': clientColor } as React.CSSProperties : undefined}
    >
      <DashboardHeader />
      {!showWelcome && <NarrativeTicker />}
      {!showWelcome && <KpiBar />}
      {!showWelcome && <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />}
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
    </div>
  );
}

const Index = () => {
  const { loading } = useAuth(true);

  if (loading) return <div className="min-h-screen bg-background" />;

  return (
    <WeekProvider>
      <DashboardContent />
    </WeekProvider>
  );
};

export default Index;
