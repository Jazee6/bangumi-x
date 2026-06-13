import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEpisode } from "@/server/functions";
import { EpTypeLabel, type EpisodeDetail } from "@/types";
import { ArrowLeftIcon } from "lucide-react";

export const Route = createFileRoute("/episodes/$episodeId")({
	loader: async ({ params }) => {
		const id = Number(params.episodeId);
		return getEpisode({ data: { id } }) as Promise<EpisodeDetail>;
	},
	component: EpisodeDetailPage,
});

function EpisodeDetailPage() {
	const episode = Route.useLoaderData() as EpisodeDetail;

	return (
		<div className="max-w-3xl">
			<Button
				variant="ghost"
				size="sm"
				className="mb-4"
				render={
					<Link
						to="/subjects/$subjectId"
						params={{ subjectId: String(episode.subject_id) }}
					/>
				}
			>
				<ArrowLeftIcon className="mr-1 size-4" />
				返回条目
			</Button>

			<h1 className="text-2xl font-bold">
				#{episode.sort} {episode.name_cn || episode.name}
			</h1>
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
					<h2 className="mb-2 text-lg font-semibold">简介</h2>
					<p className="leading-relaxed text-muted-foreground">
						{episode.desc}
					</p>
				</div>
			)}
		</div>
	);
}
