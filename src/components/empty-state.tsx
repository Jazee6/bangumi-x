import type { LucideIcon } from "lucide-react";
import { SearchXIcon } from "lucide-react";

interface EmptyStateProps {
	icon?: LucideIcon;
	title?: string;
	description?: string;
}

export function EmptyState({
	icon: Icon = SearchXIcon,
	title = "暂无数据",
	description,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<Icon className="size-12 text-muted-foreground/50" />
			<h3 className="mt-4 text-lg font-medium">{title}</h3>
			{description && (
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			)}
		</div>
	);
}
