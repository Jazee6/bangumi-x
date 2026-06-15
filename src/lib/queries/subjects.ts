import { queryOptions } from "@tanstack/react-query";
import {
	browseSubjects,
	getSubject,
	getSubjectCharacters,
	getSubjectEpisodes,
	getSubjectPersons,
	searchSubjects,
} from "@/server/functions";
import type {
	Episode,
	PagedResponse,
	RelatedCharacter,
	RelatedPerson,
	Subject,
	SubjectType,
} from "@/types";

const DETAIL_STALE_TIME = 30 * 60 * 1000; // 30 分钟
const LIST_STALE_TIME = 5 * 60 * 1000; // 5 分钟

export const subjectQueryOptions = (id: number) =>
	queryOptions<Subject>({
		queryKey: ["subject", id],
		queryFn: () => getSubject({ data: { id } }),
		staleTime: DETAIL_STALE_TIME,
	});

export const subjectEpisodesQueryOptions = (subjectId: number) =>
	queryOptions<PagedResponse<Episode>>({
		queryKey: ["subject", subjectId, "episodes"],
		queryFn: () => getSubjectEpisodes({ data: { subjectId } }),
		staleTime: DETAIL_STALE_TIME,
	});

export const subjectCharactersQueryOptions = (subjectId: number) =>
	queryOptions<RelatedCharacter[]>({
		queryKey: ["subject", subjectId, "characters"],
		queryFn: () => getSubjectCharacters({ data: { subjectId } }),
		staleTime: DETAIL_STALE_TIME,
	});

export const subjectPersonsQueryOptions = (subjectId: number) =>
	queryOptions<RelatedPerson[]>({
		queryKey: ["subject", subjectId, "persons"],
		queryFn: () => getSubjectPersons({ data: { subjectId } }),
		staleTime: DETAIL_STALE_TIME,
	});

export interface BrowseSubjectsInput {
	type: SubjectType;
	sort?: "date" | "rank";
	year?: number;
	month?: number;
	limit?: number;
	offset?: number;
}

export const browseSubjectsQueryOptions = (input: BrowseSubjectsInput) =>
	queryOptions<PagedResponse<Subject>>({
		queryKey: ["subjects", "browse", input],
		queryFn: () => browseSubjects({ data: input }),
		staleTime: LIST_STALE_TIME,
	});

export interface SearchSubjectsInput {
	keyword: string;
	sort?: "match" | "heat" | "rank" | "score";
	filter?: {
		type?: SubjectType[];
		tag?: string[];
		air_date?: string[];
		rating?: string[];
		nsfw?: boolean;
	};
	limit?: number;
	offset?: number;
}

export const searchSubjectsQueryOptions = (input: SearchSubjectsInput) =>
	queryOptions<PagedResponse<Subject>>({
		queryKey: ["subjects", "search", input],
		queryFn: () => searchSubjects({ data: input }),
		staleTime: LIST_STALE_TIME,
	});
