import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ProxyImage } from "@/components/proxy-image.tsx";
import { SubjectCardSkeleton } from "@/components/skeletons/subject-card-skeleton.tsx";
import { SubjectCard } from "@/components/subject-card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  tabsListVariants,
} from "@/components/ui/tabs.tsx";
import { Typography } from "@/components/ui/typography.tsx";
import { buildMeta, breadcrumbJsonLd, ogImageUrl, personJsonLd } from "@/lib/seo/site.ts";
import { characterRelationOrder, getRelationScore } from "@/lib/relation.ts";
import { getPerson, getPersonCharacters, getPersonSubjects } from "@/server/functions.ts";
import {
  BloodTypeLabel,
  CareerLabel,
  type PersonCareer,
  type PersonCharacter,
  type PersonDetail,
  type RelatedSubject,
} from "@/types";

interface LoaderData {
  person: PersonDetail;
  subjects: RelatedSubject[];
  characters: PersonCharacter[];
}

export const Route = createFileRoute("/persons/$personId")({
  headers: () => ({
    "Cache-Control": "public, max-age=300, s-maxage=28800, stale-while-revalidate=86400",
  }),
  loader: async ({ params }): Promise<LoaderData> => {
    const id = Number(params.personId);
    const person = await getPerson({ data: { id } });
    if (!person) {
      throw notFound();
    }
    const [subjects, characters] = await Promise.all([
      getPersonSubjects({ data: { personId: id } }),
      getPersonCharacters({ data: { personId: id } }),
    ]);
    return { person, subjects, characters };
  },
  head: ({ loaderData, params }) => {
    const { person, subjects } = loaderData!;
    const careers = person.career?.map((c: PersonCareer) => CareerLabel[c] ?? c).join("、");

    const facts: string[] = [];
    if (careers) facts.push(careers);
    if (person.gender) facts.push(person.gender);
    if (person.birth_year) {
      const m = person.birth_mon ? `${person.birth_mon}月` : "";
      const d = person.birth_day ? `${person.birth_day}日` : "";
      facts.push(`${person.birth_year}年${m}${d}生`);
    }
    const factsLine = facts.length ? `${facts.join(" · ")}。` : "";
    const subjLine = subjects.length
      ? `代表作品：${subjects
          .slice(0, 5)
          .map((s) => s.name_cn || s.name)
          .join("、")}。`
      : "";
    const description = `${person.name}。${factsLine}${subjLine}${person.summary ?? ""}`;

    return buildMeta({
      title: careers ? `${person.name} - ${careers}` : person.name,
      description,
      image: ogImageUrl("persons", params.personId),
      url: `/persons/${params.personId}`,
      type: "article",
      jsonLd: [
        personJsonLd(person),
        breadcrumbJsonLd(`/persons/${params.personId}`),
      ],
    });
  },
  pendingComponent: () => (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="aspect-square w-32 shrink-0 self-start rounded-lg" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="mt-8 space-y-4">
        <div className={tabsListVariants()}>
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <SubjectCardSkeleton key={`card-${i}`} />
          ))}
        </div>
      </div>
    </div>
  ),
  component: PersonDetailPage,
});

function PersonDetailPage() {
  const { person, subjects, characters } = Route.useLoaderData();
  if (!person) return null;

  const birthday =
    person.birth_year || person.birth_mon || person.birth_day
      ? [
          person.birth_year && `${person.birth_year}年`,
          person.birth_mon && `${person.birth_mon}月`,
          person.birth_day && `${person.birth_day}日`,
        ]
          .filter(Boolean)
          .join("")
      : null;

  return (
    <article className="max-w-5xl mx-auto">
      <header className="flex flex-col gap-6 sm:flex-row">
        <div className="w-32 shrink-0 self-start">
          <ProxyImage
            src={person.images?.large || person.images?.medium}
            alt={person.name}
            className="aspect-square w-full rounded-lg"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Typography variant="h1">{person.name}</Typography>
          <div className="mt-3 flex flex-wrap gap-2">
            {person.career?.map((c) => (
              <Badge key={c} variant="secondary">
                {CareerLabel[c] ?? c}
              </Badge>
            ))}
            {person.gender && <Badge variant="outline">{person.gender}</Badge>}
            {person.blood_type && (
              <Badge variant="outline">血型 {BloodTypeLabel[person.blood_type]}</Badge>
            )}
            {birthday && <Badge variant="outline">{birthday}</Badge>}
          </div>
          {person.summary && (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{person.summary}</p>
          )}
        </div>
      </header>

      <section className="mt-8">
        <Tabs defaultValue="subjects">
          <TabsList>
            <TabsTrigger value="subjects">相关条目 ({subjects.length})</TabsTrigger>
            <TabsTrigger value="characters">相关角色 ({characters.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="subjects" className="mt-4">
            {subjects.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">暂无相关条目</p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 list-none p-0 m-0">
                {subjects.map((s) => (
                  <li key={`${s.id}-${s.staff}`}>
                    <SubjectCard
                      id={s.id}
                      name={s.name}
                      nameCn={s.name_cn}
                      image={s.image}
                      score={0}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="characters" className="mt-4">
            {characters.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">暂无相关角色</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  characters.reduce<Record<string, typeof characters>>((acc, c) => {
                    const key = c.staff || "其他";
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
                          <li key={`${c.id}-${c.subject_id}`}>
                            <Item
                              variant="outline"
                              render={
                                <Link
                                  to="/characters/$characterId"
                                  params={{ characterId: String(c.id) }}
                                />
                              }
                            >
                              <ItemMedia variant="image">
                                <ProxyImage
                                  src={c.images?.large || c.images?.medium}
                                  alt={c.name}
                                />
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>{c.name}</ItemTitle>
                                <ItemDescription className="line-clamp-1">
                                  {c.subject_name_cn || c.subject_name}
                                </ItemDescription>
                              </ItemContent>
                              <ItemActions />
                            </Item>
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
