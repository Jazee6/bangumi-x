import { useCallback, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";

interface InfiniteScrollProps {
	onLoadMore: () => void;
	hasMore: boolean;
	loading?: boolean;
}

export function InfiniteScroll({
	onLoadMore,
	hasMore,
	loading = false,
}: InfiniteScrollProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const onLoadMoreRef = useRef(onLoadMore);
	onLoadMoreRef.current = onLoadMore;

	const handleIntersect = useCallback(
		(entries: IntersectionObserverEntry[]) => {
			if (entries[0]?.isIntersecting && hasMore && !loading) {
				onLoadMoreRef.current();
			}
		},
		[hasMore, loading],
	);

	useEffect(() => {
		const node = sentinelRef.current;
		if (!node) return;

		const observer = new IntersectionObserver(handleIntersect, {
			rootMargin: "200px",
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [handleIntersect]);

	if (!hasMore) return null;

	return (
		<div ref={sentinelRef} className="flex justify-center py-6">
			{loading && <Spinner className="size-6 text-primary" />}
		</div>
	);
}
