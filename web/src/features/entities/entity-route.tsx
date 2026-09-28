import { useQuery, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { notFound, stripSearchParams, useRouter } from "@tanstack/react-router";
import {
  isIndexableCharacter,
  isIndexablePerson,
  PUBLICATION,
  type CharacterDetail,
  type PersonDetail,
  type RelatedSubjectsResponse,
  type SourceMetadata,
} from "share";

import {
  ENTITY_KINDS,
  entityQueryOptions,
  entityRelatedQueryOptions,
  entitySubjectsQueryOptions,
  type EntityDetailOf,
  type EntityKind,
  type EntityRelatedOf,
  type EntityTab,
} from "@/features/entities/entity-kind";
import { EntityLoading, EntityRouteError } from "@/features/entities/entity-states";
import { EntityView } from "@/features/entities/entity-view";
import { ApiRequestError } from "@/lib/api-error";
import {
  buildBreadcrumbJsonLd,
  buildCharacterJsonLd,
  buildPageHead,
  buildPersonJsonLd,
  CACHE_CONTROL,
  getEntityBreadcrumbs,
  NOT_FOUND_HEADERS,
} from "@/lib/seo";

interface EntitySearch {
  tab: EntityTab;
}

interface EntityLoaderData<K extends EntityKind> {
  detail: EntityDetailOf<K>;
  subjects: RelatedSubjectsResponse;
  related?: EntityRelatedOf<K>;
  source?: SourceMetadata;
}

const DEFAULT_ENTITY_SEARCH = { tab: "subjects" } as const satisfies EntitySearch;

function isIndexableEntity(kind: EntityKind, data: EntityLoaderData<EntityKind>) {
  // 可索引判定只看条目关联，与当前 tab 无关。
  const entity = { ...data.detail, hasSubjectRelation: data.subjects.total > 0 };
  return kind === "character" ? isIndexableCharacter(entity) : isIndexablePerson(entity);
}

function buildEntityJsonLd(kind: EntityKind, data: EntityLoaderData<EntityKind>) {
  return kind === "character"
    ? buildCharacterJsonLd(data.detail as CharacterDetail, data.subjects)
    : buildPersonJsonLd(data.detail as PersonDetail, data.subjects);
}

export function createEntityRouteOptions<K extends EntityKind>(kind: K) {
  const config = ENTITY_KINDS[kind];
  const tabs = new Set<string>(["subjects", config.relatedTab]);

  return {
    validateSearch: (search: Record<string, unknown>): EntitySearch => ({
      tab:
        typeof search.tab === "string" && tabs.has(search.tab)
          ? (search.tab as EntityTab)
          : DEFAULT_ENTITY_SEARCH.tab,
    }),
    search: { middlewares: [stripSearchParams<EntitySearch>(DEFAULT_ENTITY_SEARCH)] },
    beforeLoad: ({ params }: { params: Record<string, string> }) => {
      const id = Number(params[config.param]);
      if (!Number.isInteger(id) || id <= 0) throw notFound({ headers: NOT_FOUND_HEADERS });
    },
    loaderDeps: ({ search }: { search: EntitySearch }) => ({ tab: search.tab }),
    loader: async ({
      context,
      deps,
      params,
    }: {
      context: { queryClient: QueryClient };
      deps: EntitySearch;
      params: Record<string, string>;
    }): Promise<EntityLoaderData<K>> => {
      const id = params[config.param] ?? "";
      try {
        // 条目关联总是加载：可索引判定依赖它，不能随当前 tab 变化。
        const [detail, subjects, related] = await Promise.all([
          context.queryClient.query({ ...entityQueryOptions(kind, id), staleTime: "static" }),
          context.queryClient.query({
            ...entitySubjectsQueryOptions(kind, id),
            staleTime: "static",
          }),
          deps.tab === config.relatedTab
            ? context.queryClient.query({
                ...entityRelatedQueryOptions(kind, id),
                staleTime: "static",
              })
            : undefined,
        ]);
        const fetchedAt = detail.fetchedAt ?? (related ?? subjects).fetchedAt;
        const source: SourceMetadata | undefined = fetchedAt
          ? { url: `https://bgm.tv/${config.bgmPath}/${detail.id}`, fetchedAt }
          : undefined;
        return { detail, subjects, related, source };
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          throw notFound({ headers: NOT_FOUND_HEADERS });
        }
        throw error;
      }
    },
    headers: ({ loaderData }: { loaderData?: EntityLoaderData<K> }) => {
      if (!loaderData) return NOT_FOUND_HEADERS;
      const qualified = isIndexableEntity(kind, loaderData);
      return {
        "Cache-Control": qualified ? CACHE_CONTROL.detail : CACHE_CONTROL.thin,
        ...(qualified ? {} : { "X-Robots-Tag": "noindex, follow" }),
      };
    },
    head: ({
      loaderData,
      params,
    }: {
      loaderData?: EntityLoaderData<K>;
      params: Record<string, string>;
    }) => {
      if (!loaderData) {
        return buildPageHead({ publication: PUBLICATION.notFound(`invalid-${kind}`) });
      }
      const { detail, subjects } = loaderData;
      const id = params[config.param];
      const path = `/${config.collection}/${id}`;
      return buildPageHead({
        title: `${detail.name}（${config.label}）`,
        description:
          detail.summary?.trim() ||
          `${detail.name}是 Bangumi 收录的${detail.type}，关联 ${subjects.total} 个实体。`,
        canonicalPath: path,
        imagePath: `/og${path}`,
        publication: isIndexableEntity(kind, loaderData)
          ? PUBLICATION.index(kind)
          : PUBLICATION.noindexFollow(
              detail.name === config.unnamed ? `unnamed-${kind}` : `thin-${kind}`,
            ),
        jsonLd: [
          buildBreadcrumbJsonLd(getEntityBreadcrumbs(config.label, detail)),
          buildEntityJsonLd(kind, loaderData),
        ],
      });
    },
  };
}

export function EntityPage({
  kind,
  id,
  tab,
  onTabChange,
}: {
  kind: EntityKind;
  id: string;
  tab: EntityTab;
  onTabChange: (tab: EntityTab) => void;
}) {
  const { data } = useSuspenseQuery(entityQueryOptions(kind, id));
  const subjects = useQuery({
    ...entitySubjectsQueryOptions(kind, id),
    enabled: tab === "subjects",
  });
  const related = useQuery({
    ...entityRelatedQueryOptions(kind, id),
    enabled: tab === ENTITY_KINDS[kind].relatedTab,
  });

  return (
    <EntityView
      kind={kind}
      detail={data}
      subjects={subjects.data}
      subjectsPending={subjects.isPending}
      related={related.data}
      relatedPending={related.isPending}
      tab={tab}
      onTabChange={onTabChange}
    />
  );
}

export function EntityRouteLoading() {
  return <EntityLoading tab="subjects" />;
}

export function EntityRouteErrorBoundary({ kind, error }: { kind: EntityKind; error: unknown }) {
  const router = useRouter();
  const label = ENTITY_KINDS[kind].label;
  const routeError = error instanceof Error ? error : new Error(`${label}暂时无法加载。`);
  return <EntityRouteError kind={label} error={routeError} onRetry={() => router.invalidate()} />;
}
