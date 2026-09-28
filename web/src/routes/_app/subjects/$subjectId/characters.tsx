import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { isIndexableSubject, PUBLICATION } from "share";

import {
  subjectCharactersQueryOptions,
  useSubjectCharactersQuery,
} from "@/features/characters/character-query";
import { CollectionState } from "@/features/entities/collection-state";
import { EntityCard, entityDetails } from "@/features/entities/entity-cards";
import { RelationGroups } from "@/features/entities/relation-groups";
import { subjectQueryOptions } from "@/features/subjects/subject-query";
import {
  buildBreadcrumbJsonLd,
  buildPageHead,
  buildSubjectCharactersJsonLd,
  CACHE_CONTROL,
  getSubjectBreadcrumbs,
} from "@/lib/seo";

export const Route = createFileRoute("/_app/subjects/$subjectId/characters")({
  loader: async ({ context, params }) => {
    const [subject, characters] = await Promise.all([
      context.queryClient.query({
        ...subjectQueryOptions(params.subjectId),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...subjectCharactersQueryOptions(params.subjectId),
        staleTime: "static",
      }),
    ]);
    return { subject, characters };
  },
  headers: ({ loaderData }): Record<string, string> => {
    if (loaderData?.subject && !isIndexableSubject(loaderData.subject)) {
      return {
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": CACHE_CONTROL.thin,
      };
    }
    return {
      "Cache-Control": CACHE_CONTROL.detail,
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return buildPageHead({
        canonicalPath: `/subjects/${params.subjectId}/characters`,
        imagePath: `/og/subjects/${params.subjectId}/characters`,
      });
    }
    const { subject } = loaderData;
    const publication = isIndexableSubject(subject)
      ? PUBLICATION.index("subject-characters")
      : PUBLICATION.noindexFollow(subject.nsfw ? "nsfw" : "unnamed");

    return buildPageHead({
      title: `${subject.title} 的角色列表`,
      description: `浏览 ${subject.title} 的关联角色与配音演员。`,
      canonicalPath: `/subjects/${params.subjectId}/characters`,
      imagePath: `/og/subjects/${params.subjectId}/characters`,
      publication,
      jsonLd: [
        buildBreadcrumbJsonLd(getSubjectBreadcrumbs(subject, "characters")),
        buildSubjectCharactersJsonLd(subject, loaderData.characters),
      ],
    });
  },
  component: SubjectCharactersPage,
});

function SubjectCharactersPage() {
  const { subjectId } = Route.useParams();
  const characterQuery = useSubjectCharactersQuery(subjectId);

  return (
    <CollectionState
      data={characterQuery.data}
      isPending={characterQuery.isPending}
      isError={characterQuery.isError}
      isFetching={characterQuery.isFetching}
      error={characterQuery.error}
      label="角色"
      onRetry={() => void characterQuery.refetch()}
    >
      {(data) => (
        <RelationGroups
          groups={data.groups}
          getKey={(character) => character.id}
          renderItem={(character) => (
            <EntityCard
              imageUrl={character.imageUrl}
              title={character.name}
              description={entityDetails(
                character.type,
                character.actors.map((actor) => actor.name).join("、") || null,
              )}
              link={
                <Link
                  to="/characters/$characterId"
                  params={{ characterId: character.id.toString() }}
                  search={{ tab: "subjects" }}
                />
              }
            />
          )}
        />
      )}
    </CollectionState>
  );
}
