import { Link } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";

import type { ProgressItem, ProgressPage, ProgressStage } from "share";

import { EntityImage } from "@/components/entity-image";
import { ErrorEmpty } from "@/components/error-empty";
import {
  InfiniteScrollFooter,
  type InfiniteScrollState,
} from "@/components/infinite-scroll-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getBroadcastDisplay } from "share";
import { useLocalDate } from "@/features/broadcast/use-local-date";
import { ProgressControl } from "./progress-control";

export function ProgressLoading() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex gap-3 rounded-xl border p-3 sm:gap-4 sm:p-4">
          <Skeleton shape="media" className="aspect-[2/3] w-14 shrink-0 sm:w-16" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton shape="text" className="h-5 w-2/3" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton shape="text" className="h-4 w-8" />
              <Skeleton shape="badge" className="h-5 w-14" />
            </div>
            <div className="mt-auto flex flex-wrap items-start gap-2">
              <Skeleton shape="control" className="h-8 w-36" />
              <Skeleton shape="control" className="h-8 w-16" />
              <Skeleton shape="control" className="size-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressError({
  message,
  retrying,
  onRetry,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <ErrorEmpty title="进度加载失败" message={message} retrying={retrying} onRetry={onRetry} />
  );
}

function ProgressRow({ item, today }: { item: ProgressItem; today: string | null }) {
  const broadcast = getBroadcastDisplay(item.broadcast, today);

  return (
    <article className="flex min-w-0 gap-3 rounded-xl border p-3 sm:gap-4 sm:p-4">
      <Link
        to="/subjects/$subjectId"
        params={{ subjectId: item.id.toString() }}
        aria-label={`查看条目：${item.title}`}
        className="bg-muted focus-visible:ring-ring aspect-[2/3] w-14 shrink-0 self-start overflow-hidden rounded-md outline-none focus-visible:ring-3 sm:w-16"
      >
        <EntityImage src={item.imageUrl} alt={`${item.title}封面`} iconClassName="size-5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="min-w-0 text-sm font-medium sm:text-base">
            <Link
              to="/subjects/$subjectId"
              params={{ subjectId: item.id.toString() }}
              className="line-clamp-2 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {item.title}
            </Link>
          </h2>
          <span className="text-muted-foreground shrink-0 text-xs">{item.type}</span>
        </div>
        {broadcast && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={broadcast.kind === "upcoming" ? "secondary" : "outline"}
              title={broadcast.date}
              aria-label={`${broadcast.progressText}，日期 ${broadcast.date}`}
            >
              {broadcast.progressText}
            </Badge>
          </div>
        )}
        <ProgressControl
          subjectId={item.id}
          title={item.title}
          type={item.type}
          progress={{
            stage: item.stage,
            completedChapters: item.completedChapters,
            totalChapters: item.totalChapters,
            updatedAt: item.progressUpdatedAt,
          }}
          totalChapters={item.totalChapters}
          compact
        />
      </div>
    </article>
  );
}

export function ProgressList({
  pages,
  stage,
  state,
}: {
  pages: ProgressPage[];
  stage: ProgressStage;
  state: InfiniteScrollState;
}) {
  const today = useLocalDate();
  const items: ProgressItem[] = pages.flatMap((page) => page.data);
  if (items.length === 0) {
    return (
      <Empty variant="outline" className="mt-6 min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>{stage === "completed" ? "暂无已完成进度" : "暂无进行中进度"}</EmptyTitle>
          <EmptyDescription>
            {stage === "completed" ? "完成的条目会显示在这里。" : "从条目详情页开始记录进度。"}
          </EmptyDescription>
        </EmptyHeader>
        {stage === "in_progress" && (
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link to="/discover" search={{ tab: "subjects", type: "anime" }} />}
            >
              去发现条目
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <div className="mt-4">
      <div className="space-y-3">
        {items.map((item) => (
          <ProgressRow key={item.id} item={item} today={today} />
        ))}
      </div>
      <InfiniteScrollFooter state={state} />
    </div>
  );
}
