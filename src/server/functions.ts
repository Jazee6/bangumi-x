import { createServerFn } from "@tanstack/react-start";
import { bgmFetch, buildParams } from "./utils";
import {
	idSchema,
	subjectIdSchema,
	characterIdSchema,
	personIdSchema,
	browseSubjectsSchema,
	searchSubjectsSchema,
	searchCharactersSchema,
	searchPersonsSchema,
} from "./schemas";
import type {
	CalendarDay,
	Subject,
	Episode,
	EpisodeDetail,
	Character,
	Person,
	PersonDetail,
	RelatedCharacter,
	RelatedPerson,
	RelatedSubject,
	CharacterPerson,
	PersonCharacter,
	PagedResponse,
} from "@/types";

// ─── Calendar ─────────────────────────────────────────────

export const getCalendar = createServerFn().handler(async () => {
	return bgmFetch<CalendarDay[]>("/calendar", { cacheTtl: 21600 });
});

// ─── Subject ──────────────────────────────────────────────

export const getSubject = createServerFn()
	.validator(idSchema)
	.handler(async ({ data }) => {
		return bgmFetch<Subject>(`/v0/subjects/${data.id}`, { cacheTtl: 3600 });
	});

export const browseSubjects = createServerFn()
	.validator(browseSubjectsSchema)
	.handler(async ({ data }) => {
		const params = buildParams(data);
		return bgmFetch<PagedResponse<Subject>>(`/v0/subjects?${params}`, {
			cacheTtl: 600,
		});
	});

export const searchSubjects = createServerFn({ method: "POST" })
	.validator(searchSubjectsSchema)
	.handler(async ({ data }) => {
		const params = buildParams({ limit: data.limit, offset: data.offset });
		return bgmFetch<PagedResponse<Subject>>(`/v0/search/subjects?${params}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				keyword: data.keyword,
				sort: data.sort,
				filter: data.filter,
			}),
			cacheTtl: 300,
		});
	});

export const getSubjectEpisodes = createServerFn()
	.validator(subjectIdSchema)
	.handler(async ({ data }) => {
		return bgmFetch<PagedResponse<Episode>>(
			`/v0/episodes?subject_id=${data.subjectId}`,
			{ cacheTtl: 600 },
		);
	});

export const getSubjectCharacters = createServerFn()
	.validator(subjectIdSchema)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedCharacter[]>(
			`/v0/subjects/${data.subjectId}/characters`,
			{ cacheTtl: 600 },
		);
	});

export const getSubjectPersons = createServerFn()
	.validator(subjectIdSchema)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedPerson[]>(`/v0/subjects/${data.subjectId}/persons`, {
			cacheTtl: 600,
		});
	});

// ─── Episode ──────────────────────────────────────────────

export const getEpisode = createServerFn()
	.validator(idSchema)
	.handler(async ({ data }) => {
		return bgmFetch<EpisodeDetail>(`/v0/episodes/${data.id}`, {
			cacheTtl: 3600,
		});
	});

// ─── Character ────────────────────────────────────────────

export const getCharacter = createServerFn()
	.validator(idSchema)
	.handler(async ({ data }) => {
		return bgmFetch<Character>(`/v0/characters/${data.id}`, { cacheTtl: 3600 });
	});

export const searchCharacters = createServerFn({ method: "POST" })
	.validator(searchCharactersSchema)
	.handler(async ({ data }) => {
		const params = buildParams({ limit: data.limit, offset: data.offset });
		return bgmFetch<PagedResponse<Character>>(
			`/v0/search/characters?${params}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					keyword: data.keyword,
					filter: data.filter,
				}),
				cacheTtl: 300,
			},
		);
	});

export const getCharacterSubjects = createServerFn()
	.validator(characterIdSchema)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedSubject[]>(
			`/v0/characters/${data.characterId}/subjects`,
			{ cacheTtl: 600 },
		);
	});

export const getCharacterPersons = createServerFn()
	.validator(characterIdSchema)
	.handler(async ({ data }) => {
		return bgmFetch<CharacterPerson[]>(
			`/v0/characters/${data.characterId}/persons`,
			{ cacheTtl: 600 },
		);
	});

// ─── Person ───────────────────────────────────────────────

export const getPerson = createServerFn()
	.validator(idSchema)
	.handler(async ({ data }) => {
		return bgmFetch<PersonDetail>(`/v0/persons/${data.id}`, { cacheTtl: 3600 });
	});

export const searchPersons = createServerFn({ method: "POST" })
	.validator(searchPersonsSchema)
	.handler(async ({ data }) => {
		const params = buildParams({ limit: data.limit, offset: data.offset });
		return bgmFetch<PagedResponse<Person>>(`/v0/search/persons?${params}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				keyword: data.keyword,
				filter: data.filter,
			}),
			cacheTtl: 300,
		});
	});

export const getPersonSubjects = createServerFn()
	.validator(personIdSchema)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedSubject[]>(`/v0/persons/${data.personId}/subjects`, {
			cacheTtl: 600,
		});
	});

export const getPersonCharacters = createServerFn()
	.validator(personIdSchema)
	.handler(async ({ data }) => {
		return bgmFetch<PersonCharacter[]>(
			`/v0/persons/${data.personId}/characters`,
			{ cacheTtl: 600 },
		);
	});
