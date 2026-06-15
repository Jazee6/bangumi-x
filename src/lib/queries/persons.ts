import { queryOptions } from "@tanstack/react-query";
import {
	getPerson,
	getPersonCharacters,
	getPersonSubjects,
	searchPersons,
} from "@/server/functions";
import type {
	PagedResponse,
	Person,
	PersonCharacter,
	PersonDetail,
	RelatedSubject,
} from "@/types";

const DETAIL_STALE_TIME = 30 * 60 * 1000; // 30 分钟
const LIST_STALE_TIME = 5 * 60 * 1000; // 5 分钟

export const personQueryOptions = (id: number) =>
	queryOptions<PersonDetail>({
		queryKey: ["person", id],
		queryFn: () => getPerson({ data: { id } }),
		staleTime: DETAIL_STALE_TIME,
	});

export const personSubjectsQueryOptions = (personId: number) =>
	queryOptions<RelatedSubject[]>({
		queryKey: ["person", personId, "subjects"],
		queryFn: () => getPersonSubjects({ data: { personId } }),
		staleTime: DETAIL_STALE_TIME,
	});

export const personCharactersQueryOptions = (personId: number) =>
	queryOptions<PersonCharacter[]>({
		queryKey: ["person", personId, "characters"],
		queryFn: () => getPersonCharacters({ data: { personId } }),
		staleTime: DETAIL_STALE_TIME,
	});

export interface SearchPersonsInput {
	keyword: string;
	filter?: {
		career?: string[];
	};
	limit?: number;
	offset?: number;
}

export const searchPersonsQueryOptions = (input: SearchPersonsInput) =>
	queryOptions<PagedResponse<Person>>({
		queryKey: ["persons", "search", input],
		queryFn: () => searchPersons({ data: input }),
		staleTime: LIST_STALE_TIME,
	});
