import { cn } from "../lib/utils";

export function Skeleton({ className }) {
  return <div className={cn("skeleton-shimmer rounded-2xl", className)} />;
}

export function SkeletonList({ count = 3, className, wrapperClassName = "space-y-2" }) {
  return (
    <div className={wrapperClassName}>
      {Array.from({ length: count }, (_, index) => <Skeleton key={index} className={className} />)}
    </div>
  );
}
