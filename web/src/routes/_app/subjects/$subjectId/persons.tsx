import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { isIndexableSubject, PUBLICATION } from "share";

import { CollectionState } from "@/features/entities/collection-state";
import { EntityCard, entityDetails } from "@/features/entities/entity-cards";
import { RelationGroups } from "@/features/entities/relation-groups";
import {
  subjectPersonsQueryOptions,
  useSubjectPersonsQuery,
} from "@/features/persons/person-query";
import { subjectQueryOptions } from "@/features/subjects/subject-query";
import {
  buildBreadcrumbJsonLd,
  buildPageHead,
  buildSubjectPersonsJsonLd,
  CACHE_CONTROL,
  coverShareImage,
  getSubjectBreadcrumbs,
} from "@/lib/seo";

export const Route = createFileRoute("/_app/subjects/$subjectId/persons")({
  loader: async ({ context, params }) => {
    const [subject, persons] = await Promise.all([
      context.queryClient.query({
        ...subjectQueryOptions(params.subjectId),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...subjectPersonsQueryOptions(params.subjectId),
        staleTime: "static",
      }),
    ]);
    return { subject, persons };
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
        canonicalPath: `/subjects/${params.subjectId}/persons`,
      });
    }
    const { subject } = loaderData;
    const publication = isIndexableSubject(subject)
      ? PUBLICATION.index("subject-persons")
      : PUBLICATION.noindexFollow(subject.nsfw ? "nsfw" : "unnamed");

    return buildPageHead({
      title: `${subject.title} 的制作与演出人员`,
      description: `浏览 ${subject.title} 的制作人员与演出阵容。`,
      canonicalPath: `/subjects/${params.subjectId}/persons`,
      image: coverShareImage(subject.imageUrl, subject.nsfw),
      publication,
      jsonLd: [
        buildBreadcrumbJsonLd(getSubjectBreadcrumbs(subject, "persons")),
        buildSubjectPersonsJsonLd(subject, loaderData.persons),
      ],
    });
  },
  component: SubjectPersonsPage,
});

function SubjectPersonsPage() {
  const { subjectId } = Route.useParams();
  const personQuery = useSubjectPersonsQuery(subjectId);

  return (
    <CollectionState
      data={personQuery.data}
      isPending={personQuery.isPending}
      isError={personQuery.isError}
      isFetching={personQuery.isFetching}
      error={personQuery.error}
      label="人物"
      onRetry={() => void personQuery.refetch()}
    >
      {(data) => (
        <RelationGroups
          groups={data.groups}
          getKey={(person) => `${person.id}-${person.chapters ?? ""}`}
          renderItem={(person) => (
            <EntityCard
              imageUrl={person.imageUrl}
              title={person.name}
              description={entityDetails(
                person.type,
                person.careers.join("、") || null,
                person.chapters ? `章节 ${person.chapters}` : null,
              )}
              singleLineDescription
              link={
                <Link
                  to="/persons/$personId"
                  params={{ personId: person.id.toString() }}
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
