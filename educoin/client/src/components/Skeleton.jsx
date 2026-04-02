// Reusable skeleton components for loading states
export function SkeletonText({ className = 'h-4 w-32' }) {
  return <div className={`skeleton skeleton-shimmer rounded ${className}`} />;
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card space-y-4 ${className}`}>
      <div className="skeleton skeleton-shimmer h-5 w-1/3 rounded" />
      <div className="skeleton skeleton-shimmer h-8 w-1/2 rounded" />
      <div className="skeleton skeleton-shimmer h-4 w-full rounded" />
      <div className="skeleton skeleton-shimmer h-4 w-3/4 rounded" />
    </div>
  );
}

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card space-y-3">
          <div className="skeleton skeleton-shimmer h-4 w-24 rounded" />
          <div className="skeleton skeleton-shimmer h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-1">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <div className="skeleton skeleton-shimmer h-4 w-8 rounded" />
          <div className="skeleton skeleton-shimmer h-4 w-24 rounded" />
          <div className="skeleton skeleton-shimmer h-4 w-16 rounded ml-auto" />
          <div className="skeleton skeleton-shimmer h-4 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLeaderboard() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 card">
          <div className="skeleton skeleton-shimmer h-6 w-6 rounded" />
          <div className="skeleton skeleton-shimmer h-10 w-10 rounded-full" />
          <div className="skeleton skeleton-shimmer h-4 w-32 rounded" />
          <div className="skeleton skeleton-shimmer h-4 w-16 rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}
