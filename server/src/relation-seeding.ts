import type { SubjectCharactersResponse, SubjectPersonsResponse } from "share";

import type { DirectoryDiscovery } from "./directory";
import { characterRelationPriority } from "./grouping";

const KEY_CHARACTER_LIMIT = 10;
const KEY_PERSON_RELATIONS = new Set(["导演", "原作", "系列构成", "人物设定", "音乐", "动画制作"]);

function relationDiscovery(resourceType: "character" | "person", id: number): DirectoryDiscovery {
  // Same reason as a verified entity page, so later re-verification does not rewrite the row.
  return {
    resourceType,
    externalId: id.toString(),
    discoverySource: "relation",
    indexStatus: "index",
    indexReason: resourceType === "character" ? "character_verified" : "person_verified",
  };
}

/**
 * Key characters of an indexable subject: the first main or supporting characters in Bangumi's
 * order and each one's first actor. Appearing in the subject already makes them indexable, so they
 * skip the pending queue. See ADR 0015.
 */
export function selectKeyCharacterDiscoveries(
  characters: SubjectCharactersResponse,
): DirectoryDiscovery[] {
  const selected = characters.groups
    .filter((group) => characterRelationPriority(group.relation) <= 1)
    .flatMap((group) => group.items)
    .filter((character) => character.name !== "未命名角色")
    .slice(0, KEY_CHARACTER_LIMIT);
  const actorIds = new Set(
    selected.flatMap((character) =>
      character.actors
        .slice(0, 1)
        .filter((actor) => actor.name !== "未命名人物")
        .map((actor) => actor.id),
    ),
  );
  return [
    ...selected.map((character) => relationDiscovery("character", character.id)),
    ...[...actorIds].map((id) => relationDiscovery("person", id)),
  ];
}

/** Key staff of an indexable subject: director, original creator, series composition and so on. */
export function selectKeyPersonDiscoveries(persons: SubjectPersonsResponse): DirectoryDiscovery[] {
  const ids = new Set(
    persons.groups
      .filter((group) => KEY_PERSON_RELATIONS.has(group.relation))
      .flatMap((group) => group.items)
      .filter((person) => person.name !== "未命名人物")
      .map((person) => person.id),
  );
  return [...ids].map((id) => relationDiscovery("person", id));
}
