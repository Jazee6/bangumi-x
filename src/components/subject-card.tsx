import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { ProxyImage } from "@/components/proxy-image";

interface SubjectCardProps {
	id: number;
	name: string;
	nameCn: string;
	image: string | undefined;
	score: number;
}

export function SubjectCard({
	id,
	name,
	nameCn,
	image,
	score,
}: SubjectCardProps) {
	return (
		<Link
			to="/subjects/$subjectId"
			params={{ subjectId: String(id) }}
			className="group block"
		>
			<div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted transition-shadow group-hover:shadow-lg">
				<ProxyImage src={image} alt={nameCn || name} className="size-full" />
				{score > 0 && (
					<Badge
						variant="secondary"
						className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
					>
						★ {score.toFixed(1)}
					</Badge>
				)}
			</div>
			<p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">
				{nameCn || name}
			</p>
		</Link>
	);
}
