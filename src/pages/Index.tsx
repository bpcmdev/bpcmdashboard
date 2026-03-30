import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { WeekProvider } from '@/contexts/WeekContext';
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

const Index = () => {
  const { loading } = useAuth(true);
  const [activeTab, setActiveTab] = useState('EARNED MEDIA');
  const TabContent = TAB_MAP[activeTab];

  if (loading) return <div className="min-h-screen bg-background" />;

  return (
    <WeekProvider>
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <NarrativeTicker />
        <KpiBar />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        {TabContent ? <TabContent /> : (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            {activeTab} — Coming soon
          </div>
        )}
      </div>
    </WeekProvider>
  );
};

export default Index;
