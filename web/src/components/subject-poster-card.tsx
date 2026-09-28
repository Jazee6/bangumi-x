import { Link } from "@tanstack/react-router";

import { EntityImage } from "@/components/entity-image";
import { Badge } from "@/components/ui/badge";

interface SubjectPosterCardProps {
  id: number;
  title: string;
  imageUrl: string | null;
  score?: number | null;
  rank?: number | null;
}

export function SubjectPosterCard({ id, title, imageUrl, score, rank }: SubjectPosterCardProps) {
  return (
    <article className="min-w-0">
      <Link
        to="/subjects/$subjectId"
        params={{ subjectId: id.toString() }}
        aria-label={`查看条目：${title}`}
        className="focus-visible:ring-ring block rounded-lg outline-none focus-visible:ring-3"
      >
        <div className="bg-muted relative aspect-[2/3] overflow-hidden rounded-lg">
          <EntityImage src={imageUrl} alt={`${title}封面`} />
          {score != null && (
            <Badge variant="poster" className="absolute top-2 right-2">
              {score.toFixed(1)}
            </Badge>
          )}
          {rank != null && rank !== undefined && (
            <Badge variant="poster" className="absolute bottom-2 left-2">
              #{rank}
            </Badge>
          )}
        </div>
      </Link>
      <h2 className="mt-2 line-clamp-2 text-sm font-medium">
        <Link
          to="/subjects/$subjectId"
          params={{ subjectId: id.toString() }}
          className="hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {title}
        </Link>
      </h2>
    </article>
  );
}
