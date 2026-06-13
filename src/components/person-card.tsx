import { Link } from "@tanstack/react-router";
import { ProxyImage } from "@/components/proxy-image";

interface PersonCardProps {
	id: number;
	name: string;
	image: string | undefined;
	to: "/characters/$characterId" | "/persons/$personId";
	subtitle?: string;
}

export function PersonCard({ id, name, image, to, subtitle }: PersonCardProps) {
	const params =
		to === "/characters/$characterId"
			? { characterId: String(id) }
			: { personId: String(id) };

	return (
		<Link to={to} params={params} className="group flex items-center gap-3">
			<div className="size-12 shrink-0 overflow-hidden rounded-full bg-muted">
				<ProxyImage src={image} alt={name} className="size-full" />
			</div>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium group-hover:underline">
					{name}
				</p>
				{subtitle && (
					<p className="truncate text-xs text-muted-foreground">{subtitle}</p>
				)}
			</div>
		</Link>
	);
}
