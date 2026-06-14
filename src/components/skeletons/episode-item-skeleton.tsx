import { Item, ItemContent, ItemMedia } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

export function EpisodeItemSkeleton() {
	return (
		<Item variant="outline">
			<ItemMedia variant="image">
				<Skeleton className="size-full" />
			</ItemMedia>
			<ItemContent>
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-3 w-1/2" />
			</ItemContent>
		</Item>
	);
}
