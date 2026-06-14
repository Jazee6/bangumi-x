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
		<div>
			<Link
				to="/subjects/$subjectId"
				params={{ subjectId: String(id) }}
				className="group block"
			>
				<div className="relative aspect-3/4 overflow-hidden rounded-lg bg-muted transition-shadow group-hover:shadow-2xl">
					<ProxyImage src={image} alt={nameCn || name} className="size-full" />
					{score > 0 && (
						<Badge
							variant="secondary"
							className="absolute top-2 right-2 app-blur"
						>
							{score.toFixed(1)}
						</Badge>
					)}
				</div>
			</Link>
			<p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">
				{nameCn || name}
			</p>
		</div>
	);
}
