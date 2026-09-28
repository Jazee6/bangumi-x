import type {
  PersonDetail,
  PersonSummary,
  RelatedCharacter,
  RelatedCharactersResponse,
  RelatedSubjectsResponse,
  SubjectPersonsResponse,
} from "share";

import {
  normalizeRelatedEntities,
  normalizeRelatedSubjects,
  normalizeSubjectContext,
} from "./association";
import {
  getBirthday,
  getBloodType,
  getCareers,
  getCharacterType,
  getGender,
  getPersonType,
  getRelation,
} from "./entity";
import { characterRelationPriority, groupByRelation, personRelationPriority } from "./grouping";
import { getProxiedEntityImageUrl } from "./poster";
import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

export function normalizeSubjectPersons(
  value: unknown,
  workerOrigin: string,
): SubjectPersonsResponse {
  if (!Array.isArray(value)) {
    throw new TypeError("Subject persons response must be an array");
  }

  const records: Array<{ relation: string; person: PersonSummary }> = value.flatMap((item) => {
    if (!isRecord(item) || !isPositiveInteger(item.id)) {
      return [];
    }
    const type = getPersonType(item.type);
    if (!type) {
      return [];
    }
    return [
      {
        relation: getRelation(item.relation),
        person: {
          id: item.id,
          name: getOptionalString(item.name) ?? "未命名人物",
          type,
          careers: getCareers(item.career),
          chapters: getOptionalString(item.eps),
          imageUrl: getProxiedEntityImageUrl(item.images, workerOrigin),
        },
      },
    ];
  });

  const recordGroups = groupByRelation(
    records,
    (record) => record.relation,
    (record) => JSON.stringify(record.person),
    personRelationPriority,
  );
  const groups = recordGroups.map((group) => ({
    relation: group.relation,
    items: group.items.map((record) => record.person),
  }));

  return {
    total: new Set(groups.flatMap((group) => group.items.map((person) => person.id))).size,
    groups,
  };
}

export function normalizePersonDetail(value: unknown, workerOrigin: string): PersonDetail {
  if (!isRecord(value) || !isPositiveInteger(value.id)) {
    throw new TypeError("Person response must have a positive integer ID");
  }
  const type = getPersonType(value.type);
  if (!type) {
    throw new TypeError("Person response must have a supported type");
  }

  return {
    id: value.id,
    name: getOptionalString(value.name) ?? "未命名人物",
    type,
    careers: getCareers(value.career),
    gender: getGender(value.gender),
    birthday: getBirthday(value),
    bloodType: getBloodType(value.blood_type),
    summary: getOptionalString(value.summary),
    imageUrl: getProxiedEntityImageUrl(value.images, workerOrigin),
  };
}

export function normalizePersonRelatedSubjects(
  value: unknown,
  workerOrigin: string,
): RelatedSubjectsResponse {
  return normalizeRelatedSubjects(value, workerOrigin, personRelationPriority);
}

export function normalizePersonRelatedCharacters(
  value: unknown,
  workerOrigin: string,
): RelatedCharactersResponse {
  return normalizeRelatedEntities(
    value,
    "Related characters",
    (item): RelatedCharacter | null => {
      if (!isRecord(item) || !isPositiveInteger(item.id)) {
        return null;
      }
      const type = getCharacterType(item.type);
      const subject = normalizeSubjectContext(item);
      if (!type || !subject) {
        return null;
      }
      return {
        id: item.id,
        name: getOptionalString(item.name) ?? "未命名角色",
        type,
        relation: getRelation(item.staff),
        imageUrl: getProxiedEntityImageUrl(item.images, workerOrigin),
        subject,
      };
    },
    characterRelationPriority,
  );
}
