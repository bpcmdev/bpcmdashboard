/**
 * Maps a free-form category string to one of our entry-card color tiers
 * (earned, influencer, corporate, partnership, default).
 */
export function categoryClass(category: string | null | undefined): string {
  const c = (category || '').toLowerCase();
  if (c.includes('earned') || c.includes('media') || c.includes('press')) return 'cat-earned';
  if (c.includes('influencer') || c.includes('social') || c.includes('creator')) return 'cat-influencer';
  if (c.includes('corp') || c.includes('comms') || c.includes('communication')) return 'cat-corporate';
  if (c.includes('partner') || c.includes('brand partner') || c.includes('collab')) return 'cat-partnership';
  return 'cat-default';
}

interface CategoryLabelProps {
  category: string;
  className?: string;
}

const CategoryLabel = ({ category, className = '' }: CategoryLabelProps) => {
  const cls = categoryClass(category);
  return (
    <span className={`cat-label ${cls} ${className}`}>
      {category}
    </span>
  );
};

export default CategoryLabel;
