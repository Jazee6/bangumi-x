import type {
  GroupedResponse,
  RelatedSubject,
  RelatedSubjectsResponse,
  SubjectContext,
} from "share";

import { getRelation, getSubjectTitle, getSubjectType } from "./entity";
import { groupByRelation } from "./grouping";
import { getProxiedImageUrl } from "./poster";
import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

export function normalizeSubjectContext(value: unknown): SubjectContext | null {
  if (!isRecord(value) || !isPositiveInteger(value.subject_id)) {
    return null;
  }

  return {
    id: value.subject_id,
    title: getSubjectTitle({ name: value.subject_name, name_cn: value.subject_name_cn }),
    type: getSubjectType(value.subject_type),
  };
}

export function normalizeRelatedEntities<T extends { id: number; relation: string }>(
  value: unknown,
  responseName: string,
  normalizeItem: (value: unknown) => T | null,
  relationPriority: (relation: string) => number,
): GroupedResponse<T> {
  if (!Array.isArray(value)) {
    throw new TypeError(`${responseName} response must be an array`);
  }

  const items = value.flatMap((item): T[] => {
    const normalized = normalizeItem(item);
    return normalized ? [normalized] : [];
  });
  const groups = groupByRelation(
    items,
    (item) => item.relation,
    (item) => JSON.stringify(item),
    relationPriority,
  );
  return {
    total: new Set(groups.flatMap((group) => group.items.map((item) => item.id))).size,
    groups,
  };
}

export function normalizeRelatedSubjects(
  value: unknown,
  workerOrigin: string,
  relationPriority: (relation: string) => number,
): RelatedSubjectsResponse {
  return normalizeRelatedEntities(
    value,
    "Related subjects",
    (item): RelatedSubject | null => {
      if (!isRecord(item) || !isPositiveInteger(item.id)) {
        return null;
      }
      const relation = getRelation(item.staff);
      return {
        id: item.id,
        title: getSubjectTitle(item),
        type: getSubjectType(item.type),
        relation,
        chapters: getOptionalString(item.eps),
        imageUrl: getProxiedImageUrl(item.image, workerOrigin),
      };
    },
    relationPriority,
  );
}
