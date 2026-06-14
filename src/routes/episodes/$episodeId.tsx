import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Typography } from "@/components/ui/typography";
import { getEpisode } from "@/server/functions";
import { type EpisodeDetail, EpTypeLabel } from "@/types";

export const Route = createFileRoute("/episodes/$episodeId")({
	loader: async ({ params }) => {
		const id = Number(params.episodeId);
		return getEpisode({ data: { id } }) as Promise<EpisodeDetail>;
	},
	pendingComponent: () => (
		<div className="max-w-5xl mx-auto">
			<Skeleton className="mb-4 h-8 w-24" />
			<Skeleton className="h-7 w-64" />
			<Skeleton className="mt-2 h-4 w-40" />
			<div className="mt-4 flex gap-2">
				<Skeleton className="h-6 w-16" />
				<Skeleton className="h-6 w-24" />
				<Skeleton className="h-6 w-16" />
			</div>
			<div className="mt-6 space-y-2">
				<Skeleton className="h-5 w-12" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-3/4" />
			</div>
		</div>
	),
	component: EpisodeDetailPage,
});

function EpisodeDetailPage() {
	const episode = Route.useLoaderData() as EpisodeDetail;

	return (
		<div className="max-w-5xl mx-auto">
			<Button
				variant="ghost"
				size="sm"
				className="mb-4"
				nativeButton={false}
				render={
					<Link
						to="/subjects/$subjectId"
						params={{ subjectId: String(episode.subject_id) }}
					/>
				}
			>
				<ArrowLeftIcon className="mr-1 size-4" />
				返回
			</Button>

			<Typography variant="h1">
				#{episode.sort} {episode.name_cn || episode.name}
			</Typography>
			{episode.name_cn && episode.name !== episode.name_cn && (
				<p className="mt-1 text-muted-foreground">{episode.name}</p>
			)}

			<div className="mt-4 flex flex-wrap gap-2">
				{episode.type !== 0 && (
					<Badge variant="secondary">
						{EpTypeLabel[episode.type as keyof typeof EpTypeLabel] ??
							`类型${episode.type}`}
					</Badge>
				)}
				{episode.airdate && <Badge variant="outline">{episode.airdate}</Badge>}
				{episode.duration && (
					<Badge variant="outline">{episode.duration}</Badge>
				)}
				{episode.disc > 0 && (
					<Badge variant="outline">Disc {episode.disc}</Badge>
				)}
			</div>

			{episode.desc && (
				<div className="mt-6">
					<Typography variant="h2" className="mb-2">
						简介
					</Typography>
					<p className="leading-relaxed text-muted-foreground">
						{episode.desc}
					</p>
				</div>
			)}
		</div>
	);
}
