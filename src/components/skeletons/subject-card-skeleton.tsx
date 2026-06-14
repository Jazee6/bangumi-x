import { Skeleton } from "@/components/ui/skeleton";

export function SubjectCardSkeleton() {
	return (
		<div>
			<Skeleton className="aspect-3/4 rounded-lg" />
			<div className="mt-2 space-y-1.5">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</div>
	);
}
