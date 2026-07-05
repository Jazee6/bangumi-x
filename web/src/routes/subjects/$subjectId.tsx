import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CharacterItem } from "@/components/character-item.tsx";
import { EpisodeItem } from "@/components/episode-item.tsx";
import { InfiniteScroll } from "@/components/infinite-scroll.tsx";
import { PersonItem } from "@/components/person-item.tsx";
import { ProxyImage } from "@/components/proxy-image.tsx";
import { EpisodeItemSkeleton } from "@/components/skeletons/episode-item-skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  tabsListVariants,
} from "@/components/ui/tabs.tsx";
import { Typography } from "@/components/ui/typography.tsx";
import { buildMeta } from "@/lib/seo/site.ts";
import { characterRelationOrder, getRelationScore, personRelationOrder } from "@/lib/relation.ts";
import {
  getSubject,
  getSubjectCharacters,
  getSubjectEpisodes,
  getSubjectPersons,
} from "@/server/functions.ts";
import {
  type Episode,
  type PagedResponse,
  type RelatedCharacter,
  type RelatedPerson,
  type Subject,
  SubjectTypeLabel,
} from "@/types";

const EPISODE_PAGE_SIZE = 20;

interface LoaderData {
  subject: Subject | null;
  episodes: PagedResponse<Episode> | null;
  characters: RelatedCharacter[];
  persons: RelatedPerson[];
}

export const Route = createFileRoute("/subjects/$subjectId")({
  headers: () => ({
    "Cache-Control": "public, max-age=300, s-maxage=14400, stale-while-revalidate=86400",
  }),
  loader: async ({ params }): Promise<LoaderData> => {
    const id = Number(params.subjectId);
    const subject = await getSubject({ data: { id } });
    if (!subject) {
      return { subject, episodes: null, characters: [], persons: [] };
    }
    const [episodes, characters, persons] = await Promise.all([
      getSubjectEpisodes({ data: { subjectId: id, limit: EPISODE_PAGE_SIZE } }),
      getSubjectCharacters({ data: { subjectId: id } }),
      getSubjectPersons({ data: { subjectId: id } }),
    ]);
    return {
      subject,
      episodes,
      characters,
      persons,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.subject) {
      return {
        meta: buildMeta({
          title: "条目",
        }),
      };
    }
    const { subject } = loaderData;
    const typeLabel = SubjectTypeLabel[subject.type] ?? "条目";
    const title = subject.name_cn || subject.name;

    const facts: string[] = [];
    if (subject.date) facts.push(`首播 ${subject.date}`);
    if (typeLabel) facts.push(typeLabel);
    if (subject.eps && subject.eps > 0) facts.push(`共 ${subject.eps} 话`);
    if (subject.platform) facts.push(subject.platform);
    if (subject.rating?.score && subject.rating.total > 0) {
      facts.push(`Bangumi 评分 ${subject.rating.score.toFixed(1)}（${subject.rating.total} 人）`);
    }
    const factsLine = facts.length ? `${facts.join(" · ")}。` : "";
    const description = `${title}${subject.name && subject.name !== title ? `（${subject.name}）` : ""}${
      factsLine ? ` ${factsLine}` : "。"
    }${subject.summary ? subject.summary : ""}`;

    return {
      meta: buildMeta({
        title: `${title} - ${typeLabel}`,
        description,
      }),
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
            <EpisodeItemSkeleton key={`row-${i}`} />
          ))}
        </div>
      </div>
    </div>
  ),
  component: SubjectDetailPage,
});

function SubjectDetailPage() {
  const { subject, episodes: initialEpisodes, characters, persons } = Route.useLoaderData();
  const subjectId = Number(Route.useParams().subjectId);
  if (!subject) return null;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["subject", subjectId, "episodes", { limit: EPISODE_PAGE_SIZE }] as const,
    queryFn: async ({ pageParam = 0 }): Promise<PagedResponse<Episode>> =>
      getSubjectEpisodes({
        data: { subjectId, limit: EPISODE_PAGE_SIZE, offset: pageParam },
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    initialData: initialEpisodes ? { pages: [initialEpisodes], pageParams: [0] } : undefined,
  });

  const episodes = data?.pages.flatMap((page) => page.data) ?? [];
  const episodeTotal = initialEpisodes?.total ?? episodes.length;

  return (
    <article className="max-w-5xl mx-auto">
      <header className="flex flex-col gap-6 sm:flex-row">
        <div className="w-40 shrink-0 self-start">
          <ProxyImage
            src={subject.images?.large || subject.images?.common}
            alt={subject.name_cn || subject.name}
            className="aspect-3/4 w-full rounded-lg"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Typography variant="h1">{subject.name_cn || subject.name}</Typography>
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
              <Badge variant="secondary">★ {subject.rating.score.toFixed(1)}</Badge>
            )}
            {subject.eps > 0 && <Badge variant="outline">{subject.eps} 话</Badge>}
            {subject.date && <Badge variant="outline">{subject.date}</Badge>}
            {subject.platform && <Badge variant="outline">{subject.platform}</Badge>}
          </div>
          {subject.summary && (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{subject.summary}</p>
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

      <section className="mt-8">
        <Tabs defaultValue="episodes">
          <TabsList>
            <TabsTrigger value="episodes">章节 ({episodeTotal})</TabsTrigger>
            <TabsTrigger value="characters">角色 ({characters.length})</TabsTrigger>
            <TabsTrigger value="persons">人物 ({persons.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="episodes" className="mt-4">
            {episodes.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">暂无章节</p>
            ) : (
              <>
                <ul className="space-y-2 list-none p-0 m-0">
                  {episodes.map((ep) => (
                    <li key={ep.id}>
                      <EpisodeItem episode={ep} />
                    </li>
                  ))}
                </ul>
                <InfiniteScroll
                  hasMore={hasNextPage}
                  loading={isFetchingNextPage}
                  onLoadMore={() => fetchNextPage()}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="characters" className="mt-4">
            {characters.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">暂无角色</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  characters.reduce<Record<string, typeof characters>>((acc, c) => {
                    const key = c.relation || "其他";
                    acc[key] ??= [];
                    acc[key].push(c);
                    return acc;
                  }, {}),
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
