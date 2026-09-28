import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";

import { ChapterListSkeleton, RelationCollectionSkeleton } from "@/components/content-skeletons";
import { ErrorEmpty } from "@/components/error-empty";
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

export function SubjectLoading({
  tab = "chapters",
}: {
  tab?: "chapters" | "characters" | "persons";
}) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6" aria-busy="true">
      <div className="grid gap-6 sm:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
        <Skeleton shape="media" className="aspect-[2/3] w-full max-w-64" />
        <div className="min-w-0">
          <Skeleton shape="text" className="h-10 w-3/4" />
          <Skeleton shape="text" className="mt-2 h-6 w-1/2" />
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index}>
                <Skeleton shape="text" className="h-5 w-8" />
                <Skeleton shape="text" className="mt-1 h-5 w-16" />
              </div>
            ))}
          </div>
          <Skeleton shape="media" className="mt-6 h-28 w-full" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton shape="badge" className="h-5 w-16" />
            <Skeleton shape="badge" className="h-5 w-20" />
            <Skeleton shape="badge" className="h-5 w-14" />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton shape="control" className="h-9 w-24" />
            <Skeleton shape="control" className="h-9 w-28" />
            <Skeleton shape="control" className="h-9 w-20" />
          </div>
        </div>
      </div>
      <div className="mt-6">
        <Skeleton shape="pill" className="h-9 w-64" />
        <div className="mt-4">
          {tab === "chapters" ? (
            <ChapterListSkeleton />
          ) : (
            <RelationCollectionSkeleton variant="entity" />
          )}
        </div>
      </div>
    </div>
  );
}

interface SubjectErrorProps {
  error: Error;
  retryable: boolean;
  onRetry: () => Promise<void>;
}

export function SubjectError({ error, retryable, onRetry }: SubjectErrorProps) {
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      {retryable ? (
        <ErrorEmpty
          title="条目加载失败"
          message={error.message}
          retrying={retrying}
          onRetry={() => void retry()}
        />
      ) : (
        <Empty variant="outline" className="min-h-72">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestion />
            </EmptyMedia>
            <EmptyTitle>无法查看此条目</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link to="/" />}>
              返回首页
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
