import { PosterGridSkeleton } from "@/components/content-skeletons";
import { ErrorEmpty } from "@/components/error-empty";
import { Skeleton } from "@/components/ui/skeleton";

export function ScheduleLoading() {
  return (
    <div aria-busy="true">
      <div className="mt-4 overflow-hidden pb-1">
        <Skeleton shape="pill" className="h-9 w-96 max-w-full" />
      </div>
      <PosterGridSkeleton className="mt-4" />
    </div>
  );
}

interface ScheduleErrorProps {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}

export function ScheduleError({ message, retrying, onRetry }: ScheduleErrorProps) {
  return (
    <ErrorEmpty title="每日放送加载失败" message={message} retrying={retrying} onRetry={onRetry} />
  );
}
