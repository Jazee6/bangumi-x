import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";

import { RelationCollectionSkeleton } from "@/components/content-skeletons";
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
import { ApiRequestError } from "@/lib/api-error";

export function EntityLoading({
  tab = "subjects",
}: {
  tab?: "subjects" | "persons" | "characters";
}) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6" aria-busy="true">
      <div className="grid gap-6 sm:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)]">
        <Skeleton shape="media" className="aspect-[3/4] w-full max-w-56" />
        <div className="min-w-0">
          <Skeleton shape="text" className="h-5 w-12" />
          <Skeleton shape="text" className="mt-2 h-10 w-2/3" />
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <Skeleton shape="text" className="h-5 w-8" />
                <Skeleton shape="text" className="mt-1 h-5 w-16" />
              </div>
            ))}
          </div>
          <Skeleton shape="text" className="mt-6 h-7 w-20" />
          <Skeleton shape="media" className="mt-3 h-28 w-full" />
        </div>
      </div>
      <div className="mt-6">
        <Skeleton shape="pill" className="h-9 w-64" />
        <div className="mt-4">
          <RelationCollectionSkeleton variant={tab === "subjects" ? "poster" : "entity"} />
        </div>
      </div>
    </div>
  );
}

export function EntityRouteError({
  kind,
  error,
  onRetry,
}: {
  kind: "角色" | "人物";
  error: Error;
  onRetry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);
  const retryable = !(error instanceof ApiRequestError && error.status < 500);

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
          title={`${kind}加载失败`}
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
            <EmptyTitle>无法查看此{kind}</EmptyTitle>
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
