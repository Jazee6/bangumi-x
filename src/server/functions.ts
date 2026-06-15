import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type {
	CalendarDay,
	Character,
	CharacterPerson,
	Episode,
	EpisodeDetail,
	PagedResponse,
	Person,
	PersonCharacter,
	PersonDetail,
	RelatedCharacter,
	RelatedPerson,
	RelatedSubject,
	Subject,
} from "@/types";
import {
	browseSubjectsSchema,
	characterIdSchema,
	idSchema,
	personIdSchema,
	searchCharactersSchema,
	searchPersonsSchema,
	searchSubjectsSchema,
	subjectIdSchema,
} from "./schemas";
import { BgmHttpError, bgmFetch, buildParams } from "./utils";

/**
 * 把上游 404 转成 TanStack Start 的 notFound()，
 * loader 不必关心错误形态，会直接渲染 notFoundComponent + 返回 status 404。
 * 其他错误原样抛出（5xx 走错误边界）。
 */
async function fetchOrNotFound<T>(
	path: string,
	init?: Parameters<typeof bgmFetch>[1],
): Promise<T> {
	try {
		return await bgmFetch<T>(path, init);
	} catch (err) {
		if (err instanceof BgmHttpError && err.status === 404) {
			throw notFound();
		}
		throw err;
	}
}

// ─── Calendar ─────────────────────────────────────────────

export const getCalendar = createServerFn().handler(async () => {
	return bgmFetch<CalendarDay[]>("/calendar", { cacheTtl: 21600 });
});

// ─── Subject ──────────────────────────────────────────────

export const getSubject = createServerFn()
	.validator(idSchema)
	.handler(async ({ data }) => {
		return fetchOrNotFound<Subject>(`/v0/subjects/${data.id}`, {
			cacheTtl: 3600,
		});
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
		return fetchOrNotFound<EpisodeDetail>(`/v0/episodes/${data.id}`, {
			cacheTtl: 3600,
		});
	});

// ─── Character ────────────────────────────────────────────

export const getCharacter = createServerFn()
	.validator(idSchema)
	.handler(async ({ data }) => {
		return fetchOrNotFound<Character>(`/v0/characters/${data.id}`, {
			cacheTtl: 3600,
		});
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
		return fetchOrNotFound<PersonDetail>(`/v0/persons/${data.id}`, {
			cacheTtl: 3600,
		});
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
