import PlacementVolumeChart from './PlacementVolumeChart';
import ShareOfVoiceTable from './ShareOfVoiceTable';
import SentimentBreakdown from './SentimentBreakdown';
import CoverageByTier from './CoverageByTier';
import TopPlacements from './TopPlacements';

const EarnedMediaTab = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-card p-5 border border-border">
          <PlacementVolumeChart />
        </div>
        <div className="col-span-2 bg-card p-5 border border-border">
          <ShareOfVoiceTable />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-card p-5 border border-border">
          <SentimentBreakdown />
        </div>
        <div className="col-span-2 bg-card p-5 border border-border">
          <CoverageByTier />
        </div>
      </div>
      <div className="bg-card p-5 border border-border">
        <TopPlacements />
      </div>
    </div>
  );
};

export default EarnedMediaTab;
