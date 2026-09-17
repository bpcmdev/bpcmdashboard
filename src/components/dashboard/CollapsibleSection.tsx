import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Extra controls rendered on the right of the header while the section is open (e.g. view toggles). */
  headerExtra?: ReactNode;
  /** Optional content rendered next to the title (e.g. a result count). */
  titleSuffix?: ReactNode;
  /** Class for the title so each section keeps its existing header styling. */
  titleClassName?: string;
  subtitle?: string;
  /** Spacing applied above the content while open — mirrors the section's original spacing utility. */
  contentClassName?: string;
  /** sessionStorage key; defaults to the title. */
  persistKey?: string;
}

const CollapsibleSection = ({
  title,
  defaultOpen = true,
  children,
  headerExtra,
  titleSuffix,
  titleClassName,
  subtitle,
  contentClassName,
  persistKey,
}: CollapsibleSectionProps) => {
  const storageKey = `collapsible-section:${persistKey || title}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored == null ? defaultOpen : stored === 'open';
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(storageKey, next ? 'open' : 'closed');
      } catch {
        // sessionStorage unavailable — state still toggles locally
      }
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex items-baseline gap-3 text-left min-w-0 flex-1 group"
        >
          <span className="min-w-0">
            <h3 className={titleClassName}>{title}</h3>
            {subtitle && (
              <p className="text-[11px] font-mono tracking-[0.1em] uppercase text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </span>
          {titleSuffix}
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {open && headerExtra}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')}
            />
          </button>
        </div>
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className={cn(open && contentClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
