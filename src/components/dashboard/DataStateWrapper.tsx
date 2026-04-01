import { Skeleton } from '@/components/ui/skeleton';

interface DataStateWrapperProps {
  loading: boolean;
  error: boolean;
  children: React.ReactNode;
  skeletonCount?: number;
  skeletonHeight?: string;
}

const DataStateWrapper = ({ loading, error, children, skeletonCount = 3, skeletonHeight = 'h-24' }: DataStateWrapperProps) => {
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className={`w-full ${skeletonHeight}`} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center py-24">
        <p className="text-sm text-destructive font-medium">Unable to load data. Please try refreshing.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default DataStateWrapper;
