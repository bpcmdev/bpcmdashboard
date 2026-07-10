import { useIsMobile } from '@/hooks/use-mobile';
import { useAdmin } from '@/hooks/useAdmin';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL_TABS } from '@/lib/dashboardTabs';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  enabledTabs?: string[] | null;
  isAdmin?: boolean;
}

const TabNavigation = ({ activeTab, onTabChange, enabledTabs, isAdmin }: TabNavigationProps) => {
  const isMobile = useIsMobile();
  const { clientColor } = useAdmin();
  const accent = clientColor || 'hsl(225 70% 35%)';

  // Admins always see every tab; clients are filtered by their enabled_tabs config.
  // If enabledTabs is null/undefined (e.g. column missing), default to showing all
  // so the dashboard never goes blank for legacy data.
  // Treat legacy 'partnerships' enabled_tabs entry as an alias for the merged
  // 'influencer_social' Influencer Intelligence tab so nothing disappears from
  // clients whose config only lists the old ID.
  const effectiveEnabled = Array.isArray(enabledTabs)
    ? (enabledTabs.includes('partnerships') && !enabledTabs.includes('influencer_social')
        ? [...enabledTabs, 'influencer_social']
        : enabledTabs)
    : enabledTabs;
  const visibleTabs = isAdmin || !Array.isArray(effectiveEnabled)
    ? ALL_TABS
    : ALL_TABS.filter(t => effectiveEnabled.includes(t.id));

  // Render a stable, never-empty list (admin fallback covers edge cases).
  const tabs = visibleTabs.length ? visibleTabs : ALL_TABS;

  if (isMobile) {
    return (
      <div className="bg-card border-b border-border px-4 py-2">
        <Select value={activeTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full font-mono-ui text-[10px] tracking-[0.12em] uppercase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.id} value={tab.label} className="font-mono-ui text-[10px] tracking-[0.12em] uppercase">
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-black/10 px-6 overflow-x-auto">
      <div className="flex gap-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.label;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.label)}
              className={`font-mono-ui px-4 py-3 text-[10px] tracking-[0.12em] uppercase whitespace-nowrap transition-all duration-200 relative
                ${isActive
                  ? 'text-foreground font-bold'
                  : 'text-muted-foreground font-medium hover:text-foreground'
                }`}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[3px] animate-fade-in"
                  style={{ backgroundColor: accent }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TabNavigation;
