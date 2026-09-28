import type {
  CharacterDetail,
  CharacterSummary,
  PersonLink,
  RelatedPerson,
  RelatedPersonsResponse,
  RelatedSubjectsResponse,
  SubjectCharactersResponse,
} from "share";

import {
  normalizeRelatedEntities,
  normalizeRelatedSubjects,
  normalizeSubjectContext,
} from "./association";
import {
  getBirthday,
  getBloodType,
  getCharacterType,
  getGender,
  getPersonType,
  getRelation,
} from "./entity";
import { characterRelationPriority, groupByRelation } from "./grouping";
import { getProxiedEntityImageUrl } from "./poster";
import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

function normalizeActors(value: unknown): PersonLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const actors = value.flatMap((actor): PersonLink[] => {
    if (!isRecord(actor) || !isPositiveInteger(actor.id)) {
      return [];
    }
    const type = getPersonType(actor.type);
    if (!type) {
      return [];
    }
    return [{ id: actor.id, name: getOptionalString(actor.name) ?? "未命名人物", type }];
  });
  return actors.filter(
    (actor, index) => actors.findIndex((candidate) => candidate.id === actor.id) === index,
  );
}

export function normalizeSubjectCharacters(
  value: unknown,
  workerOrigin: string,
): SubjectCharactersResponse {
  if (!Array.isArray(value)) {
    throw new TypeError("Subject characters response must be an array");
  }

  const records: Array<{ relation: string; character: CharacterSummary }> = value.flatMap(
    (item) => {
      if (!isRecord(item) || !isPositiveInteger(item.id)) {
        return [];
      }
      const type = getCharacterType(item.type);
      if (!type) {
        return [];
      }
      return [
        {
          relation: getRelation(item.relation),
          character: {
            id: item.id,
            name: getOptionalString(item.name) ?? "未命名角色",
            type,
            imageUrl: getProxiedEntityImageUrl(item.images, workerOrigin),
            actors: normalizeActors(item.actors),
          },
        },
      ];
    },
  );

  const recordGroups = groupByRelation(
    records,
    (record) => record.relation,
    (record) => JSON.stringify(record.character),
    characterRelationPriority,
  );
  const groups = recordGroups.map((group) => ({
    relation: group.relation,
    items: group.items.map((record) => record.character),
  }));
  return {
    total: new Set(groups.flatMap((group) => group.items.map((character) => character.id))).size,
    groups,
  };
}

export function normalizeCharacterDetail(value: unknown, workerOrigin: string): CharacterDetail {
  if (!isRecord(value) || !isPositiveInteger(value.id)) {
    throw new TypeError("Character response must have a positive integer ID");
  }
  const type = getCharacterType(value.type);
  if (!type) {
    throw new TypeError("Character response must have a supported type");
  }

  return {
    id: value.id,
    name: getOptionalString(value.name) ?? "未命名角色",
    type,
    gender: getGender(value.gender),
    birthday: getBirthday(value),
    bloodType: getBloodType(value.blood_type),
    summary: getOptionalString(value.summary),
    imageUrl: getProxiedEntityImageUrl(value.images, workerOrigin),
  };
}

export function normalizeCharacterRelatedSubjects(
  value: unknown,
  workerOrigin: string,
): RelatedSubjectsResponse {
  return normalizeRelatedSubjects(value, workerOrigin, characterRelationPriority);
}

export function normalizeCharacterRelatedPersons(
  value: unknown,
  workerOrigin: string,
): RelatedPersonsResponse {
  return normalizeRelatedEntities(
    value,
    "Related persons",
    (item): RelatedPerson | null => {
      if (!isRecord(item) || !isPositiveInteger(item.id)) {
        return null;
      }
      const type = getPersonType(item.type);
      const subject = normalizeSubjectContext(item);
      if (!type || !subject) {
        return null;
      }
      return {
        id: item.id,
        name: getOptionalString(item.name) ?? "未命名人物",
        type,
        relation: getRelation(item.staff),
        imageUrl: getProxiedEntityImageUrl(item.images, workerOrigin),
        subject,
      };
    },
    characterRelationPriority,
  );
}
