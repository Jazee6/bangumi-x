import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

const posterGridClassName =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8";

export function PosterGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn(posterGridClassName, className)} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-w-0">
          <Skeleton shape="media" className="aspect-[2/3]" />
          <Skeleton shape="text" className="mt-2 h-5 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function EntityGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-3", className)} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5"
        >
          <Skeleton shape="media" className="size-10 shrink-0" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton shape="text" className="h-5 w-2/3" />
            <Skeleton shape="text" className="h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChapterListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5"
        >
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton shape="text" className="h-4 w-16" />
            <Skeleton shape="text" className="h-5 w-2/3" />
          </div>
          <Skeleton shape="text" className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function RelationCollectionSkeleton({ variant }: { variant: "poster" | "entity" }) {
  return (
    <div aria-hidden="true">
      <Skeleton shape="text" className="mb-3 h-6 w-24" />
      {variant === "poster" ? <PosterGridSkeleton /> : <EntityGridSkeleton />}
    </div>
  );
}
