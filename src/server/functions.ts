import { createServerFn } from "@tanstack/react-start";
import { bgmFetch } from "./utils";
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
	SearchSubjectsBody,
	SearchCharactersBody,
	SearchPersonsBody,
	BrowseSubjectsQuery,
} from "@/types";

// ─── Calendar ─────────────────────────────────────────────

export const getCalendar = createServerFn().handler(async () => {
	return bgmFetch<CalendarDay[]>("/calendar");
});

// ─── Subject ──────────────────────────────────────────────

export const getSubject = createServerFn()
	.validator((d: { id: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<Subject>(`/v0/subjects/${data.id}`);
	});

export const browseSubjects = createServerFn()
	.validator((d: BrowseSubjectsQuery) => d)
	.handler(async ({ data }) => {
		const params = new URLSearchParams();
		params.set("type", String(data.type));
		if (data.sort) params.set("sort", data.sort);
		if (data.year) params.set("year", String(data.year));
		if (data.month) params.set("month", String(data.month));
		if (data.limit) params.set("limit", String(data.limit));
		if (data.offset) params.set("offset", String(data.offset));
		return bgmFetch<PagedResponse<Subject>>(`/v0/subjects?${params}`);
	});

export const searchSubjects = createServerFn({ method: "POST" })
	.validator((d: SearchSubjectsBody & { limit?: number; offset?: number }) => d)
	.handler(async ({ data }) => {
		const params = new URLSearchParams();
		if (data.limit) params.set("limit", String(data.limit));
		if (data.offset) params.set("offset", String(data.offset));
		return bgmFetch<PagedResponse<Subject>>(`/v0/search/subjects?${params}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				keyword: data.keyword,
				sort: data.sort,
				filter: data.filter,
			}),
		});
	});

export const getSubjectEpisodes = createServerFn()
	.validator((d: { subjectId: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<PagedResponse<Episode>>(
			`/v0/episodes?subject_id=${data.subjectId}`,
		);
	});

export const getSubjectCharacters = createServerFn()
	.validator((d: { subjectId: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedCharacter[]>(
			`/v0/subjects/${data.subjectId}/characters`,
		);
	});

export const getSubjectPersons = createServerFn()
	.validator((d: { subjectId: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedPerson[]>(`/v0/subjects/${data.subjectId}/persons`);
	});

// ─── Episode ──────────────────────────────────────────────

export const getEpisode = createServerFn()
	.validator((d: { id: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<EpisodeDetail>(`/v0/episodes/${data.id}`);
	});

// ─── Character ────────────────────────────────────────────

export const getCharacter = createServerFn()
	.validator((d: { id: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<Character>(`/v0/characters/${data.id}`);
	});

export const searchCharacters = createServerFn({ method: "POST" })
	.validator(
		(d: SearchCharactersBody & { limit?: number; offset?: number }) => d,
	)
	.handler(async ({ data }) => {
		const params = new URLSearchParams();
		if (data.limit) params.set("limit", String(data.limit));
		if (data.offset) params.set("offset", String(data.offset));
		return bgmFetch<PagedResponse<Character>>(
			`/v0/search/characters?${params}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					keyword: data.keyword,
					filter: data.filter,
				}),
			},
		);
	});

export const getCharacterSubjects = createServerFn()
	.validator((d: { characterId: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedSubject[]>(
			`/v0/characters/${data.characterId}/subjects`,
		);
	});

export const getCharacterPersons = createServerFn()
	.validator((d: { characterId: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<CharacterPerson[]>(
			`/v0/characters/${data.characterId}/persons`,
		);
	});

// ─── Person ───────────────────────────────────────────────

export const getPerson = createServerFn()
	.validator((d: { id: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<PersonDetail>(`/v0/persons/${data.id}`);
	});

export const searchPersons = createServerFn({ method: "POST" })
	.validator((d: SearchPersonsBody & { limit?: number; offset?: number }) => d)
	.handler(async ({ data }) => {
		const params = new URLSearchParams();
		if (data.limit) params.set("limit", String(data.limit));
		if (data.offset) params.set("offset", String(data.offset));
		return bgmFetch<PagedResponse<Person>>(`/v0/search/persons?${params}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				keyword: data.keyword,
				filter: data.filter,
			}),
		});
	});

export const getPersonSubjects = createServerFn()
	.validator((d: { personId: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<RelatedSubject[]>(`/v0/persons/${data.personId}/subjects`);
	});

export const getPersonCharacters = createServerFn()
	.validator((d: { personId: number }) => d)
	.handler(async ({ data }) => {
		return bgmFetch<PersonCharacter[]>(
			`/v0/persons/${data.personId}/characters`,
		);
	});
