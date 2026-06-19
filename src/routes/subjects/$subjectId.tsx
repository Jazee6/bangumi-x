import { createFileRoute } from "@tanstack/react-router";
import { CharacterItem } from "@/components/character-item";
import { EpisodeItem } from "@/components/episode-item";
import { PersonItem } from "@/components/person-item";
import { ProxyImage } from "@/components/proxy-image";
import { EpisodeItemSkeleton } from "@/components/skeletons/episode-item-skeleton";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	tabsListVariants,
} from "@/components/ui/tabs";
import { Typography } from "@/components/ui/typography";
import {
	subjectCharactersQueryOptions,
	subjectEpisodesQueryOptions,
	subjectPersonsQueryOptions,
	subjectQueryOptions,
} from "@/lib/queries/subjects";
import {
	breadcrumbJsonLd,
	ogTypeForSubject,
	serializeJsonLd,
	subjectJsonLd,
} from "@/lib/seo/json-ld";
import { buildMeta } from "@/lib/seo/site";
import {
	type Episode,
	type RelatedCharacter,
	type RelatedPerson,
	type Subject,
	SubjectTypeLabel,
} from "@/types";

interface LoaderData {
	subject: Subject;
	episodes: Episode[];
	characters: RelatedCharacter[];
	persons: RelatedPerson[];
}

const characterRelationOrder = ["主角", "配角", "客串", "其他"];

const personRelationOrder = [
	"原作",
	"导演",
	"总导演",
	"副导演",
	"系列构成",
	"脚本",
	"分镜",
	"演出",
	"人物设定",
	"总作画监督",
	"作画监督",
	"原画",
	"音乐",
	"主题歌演出",
	"动画制作",
	"制作",
	"其他",
];

function getRelationScore(relation: string, order: string[]) {
	const index = order.indexOf(relation);
	return index === -1 ? order.length : index;
}

export const Route = createFileRoute("/subjects/$subjectId")({
	// 详情页可被边缘共享缓存；浏览器本地缓存 5 分钟。
	// loader 抛 notFound() 会被根路由 notFoundComponent
	// 接住并设 404；headers() 仅在 200 路径生效，所以无需特殊处理。
	headers: () => ({
		"Cache-Control":
			"public, max-age=300, s-maxage=14400, stale-while-revalidate=86400",
	}),
	loader: async ({ context, params }): Promise<LoaderData> => {
		const id = Number(params.subjectId);
		const [subject, episodesRes, characters, persons] = await Promise.all([
			context.queryClient.ensureQueryData(subjectQueryOptions(id)),
			context.queryClient.ensureQueryData(subjectEpisodesQueryOptions(id)),
			context.queryClient.ensureQueryData(subjectCharactersQueryOptions(id)),
			context.queryClient.ensureQueryData(subjectPersonsQueryOptions(id)),
		]);
		return {
			subject,
			episodes: episodesRes.data ?? [],
			characters,
			persons,
		};
	},
	head: ({ loaderData, params }) => {
		if (!loaderData?.subject) {
			return {
				meta: buildMeta({
					title: "条目",
					path: `/subjects/${params.subjectId}`,
				}).meta,
			};
		}
		const { subject } = loaderData;
		const typeLabel = SubjectTypeLabel[subject.type] ?? "条目";
		const title = subject.name_cn || subject.name;

		// description 拼接关键事实，AI 引擎更易摘要。
		const facts: string[] = [];
		if (subject.date) facts.push(`首播 ${subject.date}`);
		if (typeLabel) facts.push(typeLabel);
		if (subject.eps && subject.eps > 0) facts.push(`共 ${subject.eps} 话`);
		if (subject.platform) facts.push(subject.platform);
		if (subject.rating?.score && subject.rating.total > 0) {
			facts.push(
				`Bangumi 评分 ${subject.rating.score.toFixed(1)}（${subject.rating.total} 人）`,
			);
		}
		const factsLine = facts.length ? `${facts.join(" · ")}。` : "";
		const description = `${title}${subject.name && subject.name !== title ? `（${subject.name}）` : ""}${
			factsLine ? ` ${factsLine}` : "。"
		}${subject.summary ? subject.summary : ""}`;

		const image =
			subject.images?.large || subject.images?.common || subject.images?.medium;

		const keywords = [
			title,
			subject.name,
			typeLabel,
			...(subject.tags?.slice(0, 8).map((t) => t.name) ?? []),
		].filter(Boolean) as string[];

		const { meta, links } = buildMeta({
			title: `${title} - ${typeLabel}`,
			description,
			path: `/subjects/${subject.id}`,
			image,
			dynamicOg: { type: "subject", id: subject.id },
			ogType: ogTypeForSubject(subject.type),
			keywords,
		});

		return {
			meta,
			links,
			...serializeJsonLd([
				breadcrumbJsonLd([
					{ name: "首页", path: "/" },
					{ name: "条目", path: "/subjects" },
					{ name: title, path: `/subjects/${subject.id}` },
				]),
				subjectJsonLd(subject),
			]),
		};
	},
	pendingComponent: () => (
		<div className="max-w-5xl mx-auto">
			<div className="flex flex-col gap-6 sm:flex-row">
				<Skeleton className="aspect-3/4 w-40 shrink-0 self-start rounded-lg" />
				<div className="min-w-0 flex-1 space-y-3">
					<Skeleton className="h-7 w-48" />
					<Skeleton className="h-4 w-32" />
					<div className="flex gap-2">
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-6 w-20" />
						<Skeleton className="h-6 w-14" />
					</div>
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-4 w-3/4" />
				</div>
			</div>
			<div className="mt-8 space-y-4">
				<div className={tabsListVariants()}>
					<Skeleton className="h-7 w-16 rounded-full" />
					<Skeleton className="h-7 w-16 rounded-full" />
					<Skeleton className="h-7 w-16 rounded-full" />
				</div>
				<div className="space-y-2">
					{Array.from({ length: 8 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
						<EpisodeItemSkeleton key={`row-${i}`} />
					))}
				</div>
			</div>
		</div>
	),
	component: SubjectDetailPage,
});

function SubjectDetailPage() {
	const { subject, episodes, characters, persons } = Route.useLoaderData();

	return (
		<article className="max-w-5xl mx-auto">
			{/* Header */}
			<header className="flex flex-col gap-6 sm:flex-row">
				<div className="w-40 shrink-0 self-start">
					<ProxyImage
						src={subject.images?.large || subject.images?.common}
						alt={subject.name_cn || subject.name}
						className="aspect-3/4 w-full rounded-lg"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<Typography variant="h1">
						{subject.name_cn || subject.name}
					</Typography>
					{subject.name_cn && subject.name !== subject.name_cn && (
						<p className="mt-1 text-muted-foreground">{subject.name}</p>
					)}
					<div className="mt-3 flex flex-wrap gap-2">
						{subject.type && (
							<Badge variant="secondary">
								{SubjectTypeLabel[subject.type] ?? `类型${subject.type}`}
							</Badge>
						)}
						{subject.rating?.score > 0 && (
							<Badge variant="secondary">
								★ {subject.rating.score.toFixed(1)}
							</Badge>
						)}
						{subject.eps > 0 && (
							<Badge variant="outline">{subject.eps} 话</Badge>
						)}
						{subject.date && <Badge variant="outline">{subject.date}</Badge>}
						{subject.platform && (
							<Badge variant="outline">{subject.platform}</Badge>
						)}
					</div>
					{subject.summary && (
						<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
							{subject.summary}
						</p>
					)}
					{subject.tags?.length > 0 && (
						<div className="mt-3 flex flex-wrap gap-1">
							{subject.tags.slice(0, 10).map((tag) => (
								<Badge key={tag.name} variant="outline" className="text-xs">
									{tag.name}
								</Badge>
							))}
						</div>
					)}
				</div>
			</header>

			{/* Tabs */}
			<section className="mt-8">
				<Tabs defaultValue="episodes">
					<TabsList>
						<TabsTrigger value="episodes">章节 ({episodes.length})</TabsTrigger>
						<TabsTrigger value="characters">
							角色 ({characters.length})
						</TabsTrigger>
						<TabsTrigger value="persons">人物 ({persons.length})</TabsTrigger>
					</TabsList>

					<TabsContent value="episodes" className="mt-4">
						{episodes.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">暂无章节</p>
						) : (
							<ul className="space-y-2 list-none p-0 m-0">
								{episodes.map((ep) => (
									<li key={ep.id}>
										<EpisodeItem episode={ep} />
									</li>
								))}
							</ul>
						)}
					</TabsContent>

					<TabsContent value="characters" className="mt-4">
						{characters.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">暂无角色</p>
						) : (
							<div className="space-y-6">
								{Object.entries(
									characters.reduce<Record<string, typeof characters>>(
										(acc, c) => {
											const key = c.relation || "其他";
											acc[key] ??= [];
											acc[key].push(c);
											return acc;
										},
										{},
									),
								)
									.sort(
										([a], [b]) =>
											getRelationScore(a, characterRelationOrder) -
											getRelationScore(b, characterRelationOrder),
									)
									.map(([relation, items]) => (
										<section key={relation}>
											<Typography variant="h3" className="mb-2">
												{relation}
											</Typography>
											<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
												{items.map((c) => (
													<li key={c.id}>
														<CharacterItem character={c} />
													</li>
												))}
											</ul>
										</section>
									))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="persons" className="mt-4">
						{persons.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">暂无人物</p>
						) : (
							<div className="space-y-6">
								{Object.entries(
									persons.reduce<Record<string, typeof persons>>((acc, p) => {
										const key = p.relation || "其他";
										acc[key] ??= [];
										acc[key].push(p);
										return acc;
									}, {}),
								)
									.sort(
										([a], [b]) =>
											getRelationScore(a, personRelationOrder) -
											getRelationScore(b, personRelationOrder),
									)
									.map(([relation, items]) => (
										<section key={relation}>
											<Typography variant="h3" className="mb-2">
												{relation}
											</Typography>
											<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
												{items.map((p) => (
													<li key={p.id}>
														<PersonItem person={p} />
													</li>
												))}
											</ul>
										</section>
									))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</section>
		</article>
	);
}
