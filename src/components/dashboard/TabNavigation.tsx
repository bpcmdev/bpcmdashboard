import { useIsMobile } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  'PIPELINE & MOMENTS',
  'KEY WINS',
  'PRODUCT LAUNCHES',
  'EARNED MEDIA',
  'INFLUENCER & SOCIAL',
  'CORPORATE COMMS',
  'AI VISIBILITY',
  'GEO / AI SOV',
  'PARTNERSHIPS',
  'TIKTOK SHOP',
];

const TabNavigation = ({ activeTab, onTabChange }: TabNavigationProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="bg-card border-b border-border px-4 py-2">
        <Select value={activeTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full text-[11px] font-semibold tracking-[0.1em] uppercase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((tab) => (
              <SelectItem key={tab} value={tab} className="text-[11px] tracking-[0.1em] uppercase">
                {tab}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="bg-card border-b border-border px-6 overflow-x-auto">
      <div className="flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-3 text-[11px] font-semibold tracking-[0.1em] uppercase whitespace-nowrap transition-colors relative
              ${activeTab === tab
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--client-accent,hsl(var(--foreground)))]'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;
