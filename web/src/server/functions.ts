import { createServerFn } from "@tanstack/react-start";
import {
  type CalendarDay,
  type Character,
  type CharacterPerson,
  type Episode,
  type EpisodeDetail,
  type PagedResponse,
  type Person,
  type PersonCharacter,
  type PersonDetail,
  type RelatedCharacter,
  type RelatedPerson,
  type RelatedSubject,
  type Subject,
  browseSubjectsSchema,
  characterIdParamSchema,
  idParamSchema,
  personIdParamSchema,
  searchCharactersSchema,
  searchPersonsSchema,
  searchSubjectsSchema,
  subjectEpisodesParamSchema,
  subjectIdParamSchema,
} from "@bangumi-x/share";
import { bgmFetch } from "./utils";

export const getCalendar = createServerFn().handler(async () => {
  return bgmFetch<CalendarDay[]>("/calendar");
});

export const getSubject = createServerFn()
  .validator(idParamSchema)
  .handler(async ({ data }) => {
    return bgmFetch<Subject | null>(`/v0/subjects/${data.id}`);
  });

export const browseSubjects = createServerFn()
  .validator(browseSubjectsSchema)
  .handler(async ({ data }) => {
    return bgmFetch<PagedResponse<Subject>>("/v0/subjects", {
      query: { type: data.type, sort: data.sort, limit: data.limit, offset: data.offset },
    });
  });

export const searchSubjects = createServerFn({ method: "POST" })
  .validator(searchSubjectsSchema)
  .handler(async ({ data }) => {
    return bgmFetch<PagedResponse<Subject>>("/v0/search/subjects", {
      method: "POST",
      body: { keyword: data.keyword, sort: data.sort, filter: data.filter, limit: data.limit, offset: data.offset },
    });
  });

export const getSubjectEpisodes = createServerFn()
  .validator(subjectEpisodesParamSchema)
  .handler(async ({ data }) => {
    return bgmFetch<PagedResponse<Episode>>("/v0/episodes", {
      query: {
        subject_id: data.subjectId,
        type: data.type,
        limit: data.limit,
        offset: data.offset,
      },
    });
  });

export const getSubjectCharacters = createServerFn()
  .validator(subjectIdParamSchema)
  .handler(({ data }) => {
    return bgmFetch<RelatedCharacter[]>(`/v0/subjects/${data.subjectId}/characters`);
  });

export const getSubjectPersons = createServerFn()
  .validator(subjectIdParamSchema)
  .handler(({ data }) => {
    return bgmFetch<RelatedPerson[]>(`/v0/subjects/${data.subjectId}/persons`);
  });

export const getEpisode = createServerFn()
  .validator(idParamSchema)
  .handler(async ({ data }) => {
    return bgmFetch<EpisodeDetail | null>(`/v0/episodes/${data.id}`);
  });

export const getCharacter = createServerFn()
  .validator(idParamSchema)
  .handler(async ({ data }) => {
    return bgmFetch<Character | null>(`/v0/characters/${data.id}`);
  });

export const searchCharacters = createServerFn({ method: "POST" })
  .validator(searchCharactersSchema)
  .handler(async ({ data }) => {
    return bgmFetch<PagedResponse<Character>>("/v0/search/characters", {
      method: "POST",
      body: { keyword: data.keyword, filter: data.filter, limit: data.limit, offset: data.offset },
    });
  });

export const getCharacterSubjects = createServerFn()
  .validator(characterIdParamSchema)
  .handler(({ data }) => {
    return bgmFetch<RelatedSubject[]>(`/v0/characters/${data.characterId}/subjects`);
  });

export const getCharacterPersons = createServerFn()
  .validator(characterIdParamSchema)
  .handler(({ data }) => {
    return bgmFetch<CharacterPerson[]>(`/v0/characters/${data.characterId}/persons`);
  });

export const getPerson = createServerFn()
  .validator(idParamSchema)
  .handler(async ({ data }) => {
    return bgmFetch<PersonDetail | null>(`/v0/persons/${data.id}`);
  });

export const searchPersons = createServerFn({ method: "POST" })
  .validator(searchPersonsSchema)
  .handler(async ({ data }) => {
    return bgmFetch<PagedResponse<Person>>("/v0/search/persons", {
      method: "POST",
      body: { keyword: data.keyword, limit: data.limit, offset: data.offset },
    });
  });

export const getPersonSubjects = createServerFn()
  .validator(personIdParamSchema)
  .handler(({ data }) => {
    return bgmFetch<RelatedSubject[]>(`/v0/persons/${data.personId}/subjects`);
  });

export const getPersonCharacters = createServerFn()
  .validator(personIdParamSchema)
  .handler(({ data }) => {
    return bgmFetch<PersonCharacter[]>(`/v0/persons/${data.personId}/characters`);
  });
