import { queryOptions } from "@tanstack/react-query";

import type {
  CharacterDetail,
  PersonDetail,
  RelatedCharactersResponse,
  RelatedPersonsResponse,
  RelatedSubjectsResponse,
} from "share";

import { ENTITY_STALE_TIME, getEntityJson } from "@/features/entities/entity-query";

// 角色与人物的详情页只在名词和互相关联的方向上不同。
export const ENTITY_KINDS = {
  character: {
    collection: "characters",
    param: "characterId",
    label: "角色",
    unnamed: "未命名角色",
    relatedTab: "persons",
    relatedLabel: "人物",
    bgmPath: "character",
  },
  person: {
    collection: "persons",
    param: "personId",
    label: "人物",
    unnamed: "未命名人物",
    relatedTab: "characters",
    relatedLabel: "角色",
    bgmPath: "person",
  },
} as const;

export type EntityKind = keyof typeof ENTITY_KINDS;
export type EntityTab = "subjects" | "persons" | "characters";

interface EntityDetails {
  character: CharacterDetail;
  person: PersonDetail;
}

interface EntityRelated {
  character: RelatedPersonsResponse;
  person: RelatedCharactersResponse;
}

export type EntityDetailOf<K extends EntityKind> = EntityDetails[K];
export type EntityRelatedOf<K extends EntityKind> = EntityRelated[K];

function entityPath(kind: EntityKind, id: string) {
  return `/${ENTITY_KINDS[kind].collection}/${encodeURIComponent(id)}`;
}

export function entityQueryOptions<K extends EntityKind>(kind: K, id: string) {
  const config = ENTITY_KINDS[kind];
  return queryOptions({
    queryKey: [config.collection, id],
    queryFn: () =>
      getEntityJson<EntityDetailOf<K>>(
        entityPath(kind, id),
        `${config.label}暂时无法加载，请稍后重试。`,
      ),
    staleTime: ENTITY_STALE_TIME,
  });
}

export function entitySubjectsQueryOptions(kind: EntityKind, id: string) {
  return queryOptions({
    queryKey: [ENTITY_KINDS[kind].collection, id, "subjects"],
    queryFn: () =>
      getEntityJson<RelatedSubjectsResponse>(
        `${entityPath(kind, id)}/subjects`,
        "关联条目暂时无法加载，请稍后重试。",
      ),
    staleTime: ENTITY_STALE_TIME,
  });
}

export function entityRelatedQueryOptions<K extends EntityKind>(kind: K, id: string) {
  const config = ENTITY_KINDS[kind];
  return queryOptions({
    queryKey: [config.collection, id, config.relatedTab],
    queryFn: () =>
      getEntityJson<EntityRelatedOf<K>>(
        `${entityPath(kind, id)}/${config.relatedTab}`,
        `关联${config.relatedLabel}暂时无法加载，请稍后重试。`,
      ),
    staleTime: ENTITY_STALE_TIME,
  });
}
