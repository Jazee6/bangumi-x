import { useEffect, useRef, useCallback } from "react";

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
			{loading && (
				<div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			)}
		</div>
	);
}
