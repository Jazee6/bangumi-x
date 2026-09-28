import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export interface InfiniteScrollState {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => Promise<unknown>;
}

export function InfiniteScrollFooter({
  state,
  loadingLabel = "正在加载更多",
}: {
  state: InfiniteScrollState;
  loadingLabel?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !state.hasNextPage || state.isFetchingNextPage || state.isFetchNextPageError) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void state.fetchNextPage();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    state.fetchNextPage,
    state.hasNextPage,
    state.isFetchingNextPage,
    state.isFetchNextPageError,
  ]);

  if (!state.hasNextPage && !state.isFetchingNextPage && !state.isFetchNextPageError) return null;

  return (
    <div ref={sentinelRef} className="flex min-h-16 items-center justify-center py-4">
      {state.isFetchingNextPage && !state.isFetchNextPageError && (
        <Spinner aria-label={loadingLabel} variant="primary" className="size-8" />
      )}
      {state.isFetchNextPageError && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={state.isFetchingNextPage}
          onClick={() => void state.fetchNextPage()}
        >
          {state.isFetchingNextPage && <Spinner />}
          重试加载
        </Button>
      )}
    </div>
  );
}
