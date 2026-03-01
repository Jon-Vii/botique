interface SkeletonProps {
  /** Width — CSS value or Tailwind class target */
  width?: string;
  /** Height — CSS value */
  height?: string;
  /** Render as a circle (avatar placeholder) */
  circle?: boolean;
  /** Number of text lines to generate */
  lines?: number;
  className?: string;
}

/** Single shimmer bar */
function SkeletonBar({
  width,
  height = "12px",
  circle,
  className = "",
}: Omit<SkeletonProps, "lines">) {
  const style: React.CSSProperties = {
    width: circle ? height : width,
    height,
    borderRadius: circle ? "50%" : undefined,
  };

  return (
    <span
      className={`skeleton-shimmer block bg-gray-3 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Geist-style skeleton loader.
 *
 * - Single bar: `<Skeleton width="120px" height="20px" />`
 * - Circle:     `<Skeleton circle height="40px" />`
 * - Text block: `<Skeleton lines={3} />`
 */
export function Skeleton({
  width,
  height,
  circle,
  lines,
  className,
}: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={`space-y-2 ${className ?? ""}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonBar
            key={i}
            width={i === lines - 1 ? "60%" : "100%"}
            height={height ?? "12px"}
          />
        ))}
      </div>
    );
  }

  return (
    <SkeletonBar
      width={width}
      height={height}
      circle={circle}
      className={className}
    />
  );
}

/** Full-card skeleton matching ListingCard layout */
export function ListingCardSkeleton() {
  return (
    <div className="bg-white border border-rule overflow-hidden animate-card-in">
      {/* Product visual placeholder */}
      <div className="aspect-square bg-gray-2 skeleton-shimmer" />
      {/* Info pane */}
      <div className="p-3 border-t border-rule space-y-2">
        <Skeleton width="60px" height="8px" />
        <Skeleton width="80%" height="13px" />
        <Skeleton width="50%" height="13px" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton width="64px" height="20px" />
          <Skeleton width="32px" height="10px" />
        </div>
      </div>
    </div>
  );
}

/** Full-card skeleton matching ShopCard layout */
export function ShopCardSkeleton() {
  return (
    <div className="bg-white border border-rule overflow-hidden animate-card-in">
      {/* Banner */}
      <div className="h-16 bg-gray-2 skeleton-shimmer" />
      {/* Avatar */}
      <div className="px-4 -mt-5 relative">
        <Skeleton circle height="40px" className="border-2 border-white" />
      </div>
      {/* Content */}
      <div className="px-4 pb-4 pt-2 space-y-2">
        <Skeleton width="60%" height="16px" />
        <Skeleton width="40%" height="10px" />
        <div className="flex gap-4 pt-1">
          <Skeleton width="40px" height="13px" />
          <Skeleton width="40px" height="13px" />
        </div>
      </div>
    </div>
  );
}

/** Stat card skeleton */
export function StatSkeleton() {
  return (
    <div className="tech-card p-4 space-y-2">
      <Skeleton width="80px" height="10px" />
      <Skeleton width="64px" height="24px" />
    </div>
  );
}
