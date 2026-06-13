import { createFileRoute, Link } from "@tanstack/react-router";
import { PersonCard } from "@/components/person-card";
import { ProxyImage } from "@/components/proxy-image";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	getSubject,
	getSubjectCharacters,
	getSubjectEpisodes,
	getSubjectPersons,
} from "@/server/functions";
import {
	type Episode,
	EpTypeLabel,
	type PagedResponse,
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

export const Route = createFileRoute("/subjects/$subjectId")({
	loader: async ({ params }) => {
		const id = Number(params.subjectId);
		const [subject, episodesRes, characters, persons] = await Promise.all([
			getSubject({ data: { id } }),
			getSubjectEpisodes({ data: { subjectId: id } }),
			getSubjectCharacters({ data: { subjectId: id } }),
			getSubjectPersons({ data: { subjectId: id } }),
		]);
		return {
			subject: subject as Subject,
			episodes: (episodesRes as PagedResponse<Episode>).data ?? [],
			characters: characters as RelatedCharacter[],
			persons: persons as RelatedPerson[],
		} satisfies LoaderData;
	},
	pendingComponent: () => (
		<div className="max-w-5xl">
			<div className="flex flex-col gap-6 sm:flex-row">
				<Skeleton className="aspect-[3/4] w-40 shrink-0 self-start rounded-lg" />
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
				<div className="flex gap-2">
					<Skeleton className="h-9 w-20" />
					<Skeleton className="h-9 w-20" />
					<Skeleton className="h-9 w-20" />
				</div>
				{Array.from({ length: 3 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					<Skeleton key={`row-${i}`} className="h-16 w-full" />
				))}
			</div>
		</div>
	),
	component: SubjectDetailPage,
});

function SubjectDetailPage() {
	const { subject, episodes, characters, persons } =
		Route.useLoaderData() as LoaderData;

	return (
		<div className="max-w-5xl">
			{/* Header */}
			<div className="flex flex-col gap-6 sm:flex-row">
				<div className="w-40 shrink-0 self-start">
					<ProxyImage
						src={subject.images?.large || subject.images?.common}
						alt={subject.name_cn || subject.name}
						className="aspect-[3/4] w-full rounded-lg"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="text-2xl font-bold">
						{subject.name_cn || subject.name}
					</h1>
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
						<p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
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
			</div>

			{/* Tabs */}
			<div className="mt-8">
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
							<div className="space-y-2">
								{episodes.map((ep) => (
									<Link
										key={ep.id}
										to="/episodes/$episodeId"
										params={{ episodeId: String(ep.id) }}
										className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
									>
										<span className="shrink-0 text-sm font-mono text-muted-foreground">
											#{ep.sort}
										</span>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">
												{ep.name_cn || ep.name}
											</p>
											<div className="flex gap-2 text-xs text-muted-foreground">
												{ep.type !== 0 && (
													<span>
														{EpTypeLabel[ep.type as keyof typeof EpTypeLabel] ??
															""}
													</span>
												)}
												{ep.airdate && <span>{ep.airdate}</span>}
												{ep.duration && <span>{ep.duration}</span>}
											</div>
										</div>
									</Link>
								))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="characters" className="mt-4">
						{characters.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">暂无角色</p>
						) : (
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{characters.map((c) => (
									<PersonCard
										key={c.id}
										id={c.id}
										name={c.name}
										image={c.images?.large || c.images?.medium}
										to="/characters/$characterId"
										subtitle={c.relation}
									/>
								))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="persons" className="mt-4">
						{persons.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">暂无人物</p>
						) : (
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{persons.map((p) => (
									<PersonCard
										key={p.id}
										id={p.id}
										name={p.name}
										image={p.images?.large || p.images?.medium}
										to="/persons/$personId"
										subtitle={p.relation}
									/>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
