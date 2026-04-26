interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

const EmptyState = ({ icon = '📋', title, description }: EmptyStateProps) => (
  <div className="empty-state">
    <div className="empty-state-icon">{icon}</div>
    <div className="empty-state-title">{title}</div>
    {description && <div className="empty-state-sub">{description}</div>}
  </div>
);

export default EmptyState;
