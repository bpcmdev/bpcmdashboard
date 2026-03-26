const TICKER_TEXT = "Active turnaround cycle — Mazdack Rassi named President Feb 2026, Frank B appointed Global Artistic Director Mar 20. Sentiment on leadership running 71% positive. Fall 2026 sticks relaunch + Line + Fill in pipeline — major earned media opportunities ahead.";

const NarrativeTicker = () => {
  return (
    <div className="dashboard-ticker px-6 py-2.5 flex items-center gap-4 overflow-hidden">
      <span className="shrink-0 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 text-positive border border-accent/30" style={{ backgroundColor: 'hsla(145, 63%, 42%, 0.2)' }}>
        NARRATIVE WATCH
      </span>
      <div className="overflow-hidden flex-1">
        <div className="animate-ticker whitespace-nowrap inline-block">
          <span className="text-xs tracking-wide mr-24">{TICKER_TEXT}</span>
          <span className="text-xs tracking-wide mr-24">{TICKER_TEXT}</span>
        </div>
      </div>
    </div>
  );
};

export default NarrativeTicker;
