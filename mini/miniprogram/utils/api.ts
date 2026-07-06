import {
  type CalendarDay,
  type Character,
  type CharacterPerson,
  type Episode,
  type PagedResponse,
  type Person,
  type PersonCharacter,
  type PersonDetail,
  type RelatedCharacter,
  type RelatedPerson,
  type RelatedSubject,
  type Subject,
  SubjectType,
} from "../types";
import { bgmFetch } from "./request";

export function getCalendar(): Promise<CalendarDay[]> {
  return bgmFetch<CalendarDay[]>("/calendar");
}

export function getSubject(id: number): Promise<Subject | null> {
  return bgmFetch<Subject | null>(`/v0/subjects/${id}`);
}

export function browseSubjects(
  type: SubjectType,
  limit: number,
  offset: number,
): Promise<PagedResponse<Subject>> {
  return bgmFetch<PagedResponse<Subject>>("/v0/subjects", {
    query: { type, sort: "rank", limit, offset },
  });
}

export function searchSubjects(
  keyword: string,
  limit: number,
  offset: number,
  type?: SubjectType,
): Promise<PagedResponse<Subject>> {
  return bgmFetch<PagedResponse<Subject>>("/v0/search/subjects", {
    method: "POST",
    body: {
      keyword,
      sort: "rank",
      filter: type ? { type: [type] } : undefined,
      limit,
      offset,
    },
  });
}

export function getSubjectEpisodes(
  subjectId: number,
  limit: number,
  offset: number,
): Promise<PagedResponse<Episode>> {
  return bgmFetch<PagedResponse<Episode> | null>("/v0/episodes", {
    query: { subject_id: subjectId, limit, offset },
  }).then((r) => r ?? { total: 0, limit, offset, data: [] });
}

export function getSubjectCharacters(subjectId: number): Promise<RelatedCharacter[]> {
  return bgmFetch<RelatedCharacter[]>(`/v0/subjects/${subjectId}/characters`);
}

export function getSubjectPersons(subjectId: number): Promise<RelatedPerson[]> {
  return bgmFetch<RelatedPerson[]>(`/v0/subjects/${subjectId}/persons`);
}

export function getCharacter(id: number): Promise<Character | null> {
  return bgmFetch<Character | null>(`/v0/characters/${id}`);
}

export function searchCharacters(
  keyword: string,
  limit: number,
  offset: number,
): Promise<PagedResponse<Character>> {
  return bgmFetch<PagedResponse<Character>>("/v0/search/characters", {
    method: "POST",
    body: { keyword, limit, offset },
  });
}

export function getCharacterSubjects(characterId: number): Promise<RelatedSubject[]> {
  return bgmFetch<RelatedSubject[]>(`/v0/characters/${characterId}/subjects`);
}

export function getCharacterPersons(characterId: number): Promise<CharacterPerson[]> {
  return bgmFetch<CharacterPerson[]>(`/v0/characters/${characterId}/persons`);
}

export function getPerson(id: number): Promise<PersonDetail | null> {
  return bgmFetch<PersonDetail | null>(`/v0/persons/${id}`);
}

export function searchPersons(
  keyword: string,
  limit: number,
  offset: number,
): Promise<PagedResponse<Person>> {
  return bgmFetch<PagedResponse<Person>>("/v0/search/persons", {
    method: "POST",
    body: { keyword, limit, offset },
  });
}

export function getPersonSubjects(personId: number): Promise<RelatedSubject[]> {
  return bgmFetch<RelatedSubject[]>(`/v0/persons/${personId}/subjects`);
}

export function getPersonCharacters(personId: number): Promise<PersonCharacter[]> {
  return bgmFetch<PersonCharacter[]>(`/v0/persons/${personId}/characters`);
}
