const SentimentBreakdown = () => {
  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Sentiment Breakdown
      </h3>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Positive</span>
            <span className="text-xs font-bold">58%</span>
          </div>
          <div className="h-5 bg-secondary w-full">
            <div className="h-full bg-foreground" style={{ width: '58%' }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Neutral</span>
            <span className="text-xs font-bold">31%</span>
          </div>
          <div className="h-5 bg-secondary w-full">
            <div className="h-full bg-muted-foreground/50" style={{ width: '31%' }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Negative</span>
            <span className="text-xs font-bold">11%</span>
          </div>
          <div className="h-5 bg-secondary w-full">
            <div className="h-full bg-destructive" style={{ width: '11%' }} />
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Positive drivers:</span> Frank B, Hydro Grip launch, Ulta expansion
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Negative themes:</span> prior sales decline coverage, pricing
        </p>
      </div>
    </div>
  );
};

export default SentimentBreakdown;
