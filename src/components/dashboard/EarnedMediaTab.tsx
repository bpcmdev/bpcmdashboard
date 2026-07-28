import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, X, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWeek } from '@/contexts/WeekContext';
import PressHitsLog from './PressHitsLog';

const EarnedMediaTab = () => {
  const [searchText, setSearchText] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [corporateOnly, setCorporateOnly] = useState(false);

  const {
    rangeMode, setRangeMode, rangeFrom, rangeTo, setRangeFrom, setRangeTo,
    selectedWeek,
  } = useWeek();

  // When entering Range mode for the first time, seed dates from the active week.
  useEffect(() => {
    if (rangeMode === 'range' && (!rangeFrom || !rangeTo) && selectedWeek) {
      const start = selectedWeek;
      const end = new Date(selectedWeek + 'T00:00:00');
      end.setDate(end.getDate() + 6);
      setRangeFrom(start);
      setRangeTo(end.toISOString().split('T')[0]);
    }
  }, [rangeMode, rangeFrom, rangeTo, selectedWeek, setRangeFrom, setRangeTo]);

  const fromDate = rangeFrom ? parseISO(rangeFrom) : undefined;
  const toDate = rangeTo ? parseISO(rangeTo) : undefined;

  const rangeBadgeText = rangeMode === 'range' && fromDate && toDate
    ? `${format(fromDate, 'MMM d')} – ${format(toDate, 'MMM d, yyyy')}`
    : null;

  const hasFilters = searchText || tierFilter !== 'all' || sentimentFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setSearchText('');
    setTierFilter('all');
    setSentimentFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Date scope controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex border border-border bg-card">
          <button
            onClick={() => setRangeMode('week')}
            className={cn(
              'text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 transition-colors',
              rangeMode === 'week' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Week View
          </button>
          <button
            onClick={() => setRangeMode('range')}
            className={cn(
              'text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 transition-colors border-l border-border',
              rangeMode === 'range' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Custom Range
          </button>
        </div>

        {rangeMode === 'range' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('text-xs justify-start gap-2', !fromDate && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {fromDate ? format(fromDate, 'MMM d, yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(d) => d && setRangeFrom(format(d, 'yyyy-MM-dd'))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('text-xs justify-start gap-2', !toDate && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {toDate ? format(toDate, 'MMM d, yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(d) => d && setRangeTo(format(d, 'yyyy-MM-dd'))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {rangeBadgeText && (
              <Badge variant="outline" className="text-[10px] tracking-wider uppercase font-bold">
                {rangeBadgeText}
              </Badge>
            )}
          </>
        )}

        <div className="inline-flex border border-border bg-card ml-auto">
          <button
            onClick={() => setCorporateOnly(false)}
            className={cn(
              'text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 transition-colors',
              !corporateOnly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All Coverage
          </button>
          <button
            onClick={() => setCorporateOnly(true)}
            className={cn(
              'text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 transition-colors border-l border-border',
              corporateOnly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Corporate & Executive
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
        <div className="md:col-span-3 bg-card p-4 md:p-5 border border-border">
          <PlacementVolumeChart corporateOnly={corporateOnly} />
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
          <CoverageByTier corporateOnly={corporateOnly} />
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
      <PressHitsLog corporateOnly={corporateOnly} />
    </div>
  );
};

export default EarnedMediaTab;
