import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Typography } from "@/components/ui/typography";
import {
	breadcrumbJsonLd,
	episodeJsonLd,
	serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildMeta } from "@/lib/seo/site";
import { getEpisode, getSubject } from "@/server/functions";
import { type EpisodeDetail, EpTypeLabel, type Subject } from "@/types";

interface LoaderData {
	episode: EpisodeDetail;
	subject: Subject | null;
}

export const Route = createFileRoute("/episodes/$episodeId")({
	headers: () => ({
		"Cache-Control":
			"public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
	}),
	loader: async ({ params }) => {
		const id = Number(params.episodeId);
		const episode = (await getEpisode({ data: { id } })) as EpisodeDetail;
		// 拉父番剧用于 breadcrumb / JSON-LD partOfSeries.name；失败容忍。
		let subject: Subject | null = null;
		try {
			subject = (await getSubject({
				data: { id: episode.subject_id },
			})) as Subject;
		} catch {
			subject = null;
		}
		return { episode, subject } satisfies LoaderData;
	},
	head: ({ loaderData, params }) => {
		const data = loaderData as LoaderData | undefined;
		if (!data?.episode) {
			return {
				meta: buildMeta({
					title: "章节",
					path: `/episodes/${params.episodeId}`,
				}).meta,
			};
		}
		const { episode, subject } = data;
		const epName = episode.name_cn || episode.name || `第 ${episode.sort} 话`;
		const seriesName = subject?.name_cn || subject?.name;
		const title = seriesName
			? `${seriesName} 第 ${episode.sort} 话 ${epName}`
			: `第 ${episode.sort} 话 ${epName}`;

		const facts: string[] = [];
		if (episode.airdate) facts.push(`首播 ${episode.airdate}`);
		if (episode.duration) facts.push(`时长 ${episode.duration}`);
		const factsLine = facts.length ? `${facts.join(" · ")}。` : "";
		const description = `${title}。${factsLine}${episode.desc ?? ""}`;

		const { meta, links } = buildMeta({
			title,
			description,
			path: `/episodes/${episode.id}`,
			ogType: "video.episode",
			image: subject?.images?.large || subject?.images?.common || undefined,
			dynamicOg: { type: "episode", id: episode.id },
		});

		return {
			meta,
			links,
			...serializeJsonLd([
				breadcrumbJsonLd([
					{ name: "首页", path: "/" },
					{ name: "条目", path: "/subjects" },
					...(subject
						? [
								{
									name: subject.name_cn || subject.name,
									path: `/subjects/${subject.id}`,
								},
							]
						: []),
					{
						name: epName,
						path: `/episodes/${episode.id}`,
					},
				]),
				episodeJsonLd(episode, seriesName ?? undefined),
			]),
		};
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
	const { episode } = Route.useLoaderData() as LoaderData;

	return (
		<article className="max-w-5xl mx-auto">
			<nav aria-label="返回">
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
			</nav>

			<header>
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
					{episode.airdate && (
						<Badge variant="outline">{episode.airdate}</Badge>
					)}
					{episode.duration && (
						<Badge variant="outline">{episode.duration}</Badge>
					)}
					{episode.disc > 0 && (
						<Badge variant="outline">Disc {episode.disc}</Badge>
					)}
				</div>
			</header>

			{episode.desc && (
				<section className="mt-6">
					<Typography variant="h2" className="mb-2">
						简介
					</Typography>
					<p className="leading-relaxed text-muted-foreground">
						{episode.desc}
					</p>
				</section>
			)}
		</article>
	);
}
