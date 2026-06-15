import { queryOptions } from "@tanstack/react-query";
import {
	getCharacter,
	getCharacterPersons,
	getCharacterSubjects,
	searchCharacters,
} from "@/server/functions";
import type {
	Character,
	CharacterPerson,
	PagedResponse,
	RelatedSubject,
} from "@/types";

const DETAIL_STALE_TIME = 30 * 60 * 1000; // 30 分钟
const LIST_STALE_TIME = 5 * 60 * 1000; // 5 分钟

export const characterQueryOptions = (id: number) =>
	queryOptions<Character>({
		queryKey: ["character", id],
		queryFn: () => getCharacter({ data: { id } }),
		staleTime: DETAIL_STALE_TIME,
	});

export const characterSubjectsQueryOptions = (characterId: number) =>
	queryOptions<RelatedSubject[]>({
		queryKey: ["character", characterId, "subjects"],
		queryFn: () => getCharacterSubjects({ data: { characterId } }),
		staleTime: DETAIL_STALE_TIME,
	});

export const characterPersonsQueryOptions = (characterId: number) =>
	queryOptions<CharacterPerson[]>({
		queryKey: ["character", characterId, "persons"],
		queryFn: () => getCharacterPersons({ data: { characterId } }),
		staleTime: DETAIL_STALE_TIME,
	});

export interface SearchCharactersInput {
	keyword: string;
	filter?: {
		nsfw?: boolean;
	};
	limit?: number;
	offset?: number;
}

export const searchCharactersQueryOptions = (input: SearchCharactersInput) =>
	queryOptions<PagedResponse<Character>>({
		queryKey: ["characters", "search", input],
		queryFn: () => searchCharacters({ data: input }),
		staleTime: LIST_STALE_TIME,
	});
