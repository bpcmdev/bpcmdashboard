import { useState } from 'react';
import PlacementVolumeChart from './PlacementVolumeChart';
import ShareOfVoiceTable from './ShareOfVoiceTable';
import SentimentBreakdown from './SentimentBreakdown';
import CoverageByTier from './CoverageByTier';
import TopPlacements from './TopPlacements';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import PressHitsLog from './PressHitsLog';

const EarnedMediaTab = () => {
  const [searchText, setSearchText] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const hasFilters = searchText || tierFilter !== 'all' || sentimentFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setSearchText('');
    setTierFilter('all');
    setSentimentFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
        <div className="md:col-span-3 bg-card p-4 md:p-5 border border-border">
          <PlacementVolumeChart />
        </div>
        <div className="md:col-span-2 bg-card p-4 md:p-5 border border-border">
          <ShareOfVoiceTable />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
        <div className="md:col-span-3 bg-card p-4 md:p-5 border border-border">
          <SentimentBreakdown />
        </div>
        <div className="md:col-span-2 bg-card p-4 md:p-5 border border-border">
          <CoverageByTier />
        </div>
      </div>

      {/* Search & Filter controls */}
      <div className="bg-card p-4 md:p-5 border border-border space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search headlines or outlets..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-full md:w-[130px] text-xs">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Tiers</SelectItem>
                <SelectItem value="1" className="text-xs">Tier 1</SelectItem>
                <SelectItem value="2" className="text-xs">Tier 2</SelectItem>
                <SelectItem value="3" className="text-xs">Tier 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-full md:w-[130px] text-xs">
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Sentiment</SelectItem>
                <SelectItem value="positive" className="text-xs">Positive</SelectItem>
                <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                <SelectItem value="negative" className="text-xs">Negative</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[130px] text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Types</SelectItem>
                <SelectItem value="earned" className="text-xs">Earned</SelectItem>
                <SelectItem value="newswire" className="text-xs">Newswire</SelectItem>
                <SelectItem value="contributed" className="text-xs">Contributed</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>
        <TopPlacements
          searchText={searchText}
          tierFilter={tierFilter}
          sentimentFilter={sentimentFilter}
          typeFilter={typeFilter}
        />
      </div>

      {/* All Press Hits Running Log */}
      <PressHitsLog />
    </div>
  );
};

export default EarnedMediaTab;
