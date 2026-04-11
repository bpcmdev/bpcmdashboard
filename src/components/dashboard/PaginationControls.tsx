interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PaginationControls = ({ currentPage, totalPages, onPageChange }: PaginationControlsProps) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-2.5 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted"
      >
        Previous
      </button>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-7 h-7 text-[11px] font-semibold transition-colors ${p === currentPage ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
        >
          {p}
        </button>
      ))}
      <span className="text-[10px] text-muted-foreground ml-1">of {totalPages}</span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-2.5 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted"
      >
        Next
      </button>
    </div>
  );
};

export default PaginationControls;
