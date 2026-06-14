import type { LucideIcon } from "lucide-react";
import { Typography } from "@/components/ui/typography";
import { SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
	icon?: LucideIcon;
	title?: string;
	description?: string;
	action?: ReactNode;
}

export function EmptyState({
	icon: Icon = SearchXIcon,
	title = "暂无数据",
	description,
	action,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<Icon className="size-12 text-muted-foreground/50" />
			<Typography variant="h3" className="mt-4">{title}</Typography>
			{description && (
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			)}
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}
