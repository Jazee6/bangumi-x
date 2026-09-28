import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";

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

export function ChapterLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6" aria-busy="true">
      <Skeleton shape="text" className="h-5 w-20" />
      <Skeleton shape="text" className="mt-2 h-10 w-3/4" />
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index}>
            <Skeleton shape="text" className="h-5 w-8" />
            <Skeleton shape="text" className="mt-1 h-5 w-16" />
          </div>
        ))}
      </div>
      <Skeleton shape="text" className="mt-6 h-7 w-20" />
      <Skeleton shape="control" className="mt-3 h-9 w-56" />
      <Skeleton shape="text" className="mt-6 h-7 w-20" />
      <Skeleton shape="media" className="mt-3 h-28 w-full" />
      <div className="mt-8 border-t pt-4">
        <Skeleton shape="text" className="h-5 w-24" />
      </div>
    </div>
  );
}

interface ChapterErrorProps {
  error: Error;
  retryable: boolean;
  onRetry: () => Promise<void>;
}

export function ChapterError({ error, retryable, onRetry }: ChapterErrorProps) {
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
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      {retryable ? (
        <ErrorEmpty
          title="章节加载失败"
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
            <EmptyTitle>无法查看此章节</EmptyTitle>
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
