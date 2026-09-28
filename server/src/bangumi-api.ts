const DEFAULT_BANGUMI_API_URL = "https://api.bgm.tv";

function getBangumiApiBaseUrl(apiUrl?: string): string {
  const baseUrl = apiUrl?.trim() || DEFAULT_BANGUMI_API_URL;
  return `${baseUrl.replace(/\/+$/, "")}/`;
}

export function getBangumiScheduleUrl(apiUrl?: string): URL {
  return new URL("calendar", getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiSubjectUrl(subjectId: number, apiUrl?: string): URL {
  return new URL(`v0/subjects/${subjectId}`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiSubjectsUrl(
  type: number,
  year: number,
  limit: number,
  offset: number,
  apiUrl?: string,
  month?: number,
): URL {
  const url = new URL("v0/subjects", getBangumiApiBaseUrl(apiUrl));
  url.searchParams.set("type", type.toString());
  url.searchParams.set("year", year.toString());
  if (month !== undefined) url.searchParams.set("month", month.toString());
  url.searchParams.set("sort", "rank");
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  return url;
}

export function getBangumiSearchUrl(
  entity: "subjects" | "characters" | "persons",
  limit: number,
  offset: number,
  apiUrl?: string,
): URL {
  const url = new URL(`v0/search/${entity}`, getBangumiApiBaseUrl(apiUrl));
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  return url;
}

export function getBangumiChaptersUrl(
  subjectId: number,
  limit: number,
  offset: number,
  apiUrl?: string,
  type?: number,
): URL {
  const url = new URL("v0/episodes", getBangumiApiBaseUrl(apiUrl));
  url.searchParams.set("subject_id", subjectId.toString());
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  if (type !== undefined) url.searchParams.set("type", type.toString());
  return url;
}

export function getBangumiChapterUrl(chapterId: number, apiUrl?: string): URL {
  return new URL(`v0/episodes/${chapterId}`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiSubjectPersonsUrl(subjectId: number, apiUrl?: string): URL {
  return new URL(`v0/subjects/${subjectId}/persons`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiSubjectCharactersUrl(subjectId: number, apiUrl?: string): URL {
  return new URL(`v0/subjects/${subjectId}/characters`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiPersonUrl(personId: number, apiUrl?: string): URL {
  return new URL(`v0/persons/${personId}`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiPersonSubjectsUrl(personId: number, apiUrl?: string): URL {
  return new URL(`v0/persons/${personId}/subjects`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiPersonCharactersUrl(personId: number, apiUrl?: string): URL {
  return new URL(`v0/persons/${personId}/characters`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiCharacterUrl(characterId: number, apiUrl?: string): URL {
  return new URL(`v0/characters/${characterId}`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiCharacterSubjectsUrl(characterId: number, apiUrl?: string): URL {
  return new URL(`v0/characters/${characterId}/subjects`, getBangumiApiBaseUrl(apiUrl));
}

export function getBangumiCharacterPersonsUrl(characterId: number, apiUrl?: string): URL {
  return new URL(`v0/characters/${characterId}/persons`, getBangumiApiBaseUrl(apiUrl));
}
