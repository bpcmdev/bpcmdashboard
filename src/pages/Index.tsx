import { useState } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import NarrativeTicker from '@/components/dashboard/NarrativeTicker';
import KpiBar from '@/components/dashboard/KpiBar';
import TabNavigation from '@/components/dashboard/TabNavigation';
import EarnedMediaTab from '@/components/dashboard/EarnedMediaTab';

const Index = () => {
  const [activeTab, setActiveTab] = useState('EARNED MEDIA');

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <NarrativeTicker />
      <KpiBar />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'EARNED MEDIA' && <EarnedMediaTab />}
      {activeTab !== 'EARNED MEDIA' && (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          {activeTab} — Coming soon
        </div>
      )}
    </div>
  );
};

export default Index;
