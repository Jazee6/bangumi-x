import {
  DISCOVERY_PAGE_SIZE,
  RANKINGS_MAX_ITEMS,
  RANKINGS_MIN_YEAR,
  RANKINGS_PAGE_SIZE,
  SEASON_MONTHS,
  SEARCH_KEYWORD_MAX_LENGTH,
  SEASON_VALUES,
  getCurrentSeason,
  getCurrentYear,
  isFutureSeason,
  type Season,
} from "share";

import { ApiError } from "../api-error";
import { getBangumiSearchUrl, getBangumiSubjectsUrl } from "../bangumi-api";
import {
  normalizeCharacterSearchBatch,
  normalizePersonSearchBatch,
  normalizePopularSubjectBatch,
  normalizeSubjectSearchBatch,
  SUBJECT_TYPE_FILTERS,
  type SearchBatch,
} from "../discovery";
import { parsePositiveInteger } from "../validation";
import type { AnonymousApp, AnonymousKit } from "./kit";

const SEARCH_CACHE_CONTROL = "public, max-age=600";
const DIRECTORY_COLLECTION_CACHE_CONTROL = "public, max-age=86400";
const MAX_DISCOVERY_PAGE = 5;

export function registerDiscoveryRoutes(app: AnonymousApp, kit: AnonymousKit) {
  const { runtime, loadJson, jsonCache, recordDiscoveries } = kit;

  function requireSearchQuery(
    keywordValue: string | undefined,
    pageValue: string | undefined,
    pageSizeValue: string | undefined,
  ) {
    const keyword = keywordValue?.trim();
    const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue);
    const pageSize =
      pageSizeValue === undefined ? DISCOVERY_PAGE_SIZE : parsePositiveInteger(pageSizeValue);
    if (
      !keyword ||
      keyword.length > SEARCH_KEYWORD_MAX_LENGTH ||
      !page ||
      page > MAX_DISCOVERY_PAGE ||
      pageSize !== DISCOVERY_PAGE_SIZE
    ) {
      throw new ApiError(400, { code: "INVALID_DISCOVERY_QUERY", message: "发现参数无效。" });
    }
    return { keyword, page, pageSize };
  }

  function searchPage<T>(batch: SearchBatch<T>, page: number, pageSize: number, fetchedAt: Date) {
    const offset = (page - 1) * pageSize;
    return {
      page,
      pageSize,
      data: batch.data,
      hasPrevious: page > 1,
      hasNext:
        batch.total === null ? batch.rawCount === pageSize : offset + batch.rawCount < batch.total,
      ...(batch.total === null ? {} : { total: batch.total }),
      fetchedAt: fetchedAt.toISOString(),
    };
  }

  app.get(
    "/rankings",
    jsonCache("rankings", DIRECTORY_COLLECTION_CACHE_CONTROL),
    async (context) => {
      const now = runtime.now();
      const currentYear = getCurrentYear(now);
      const yearValue = context.req.query("year");
      const year = yearValue === undefined ? currentYear : parsePositiveInteger(yearValue);
      const seasonValue = context.req.query("season");
      const season =
        seasonValue === undefined
          ? getCurrentSeason(now)
          : SEASON_VALUES.includes(seasonValue as Season)
            ? (seasonValue as Season)
            : null;
      const pageValue = context.req.query("page");
      const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue);
      const pageSizeValue = context.req.query("pageSize");
      const pageSize =
        pageSizeValue === undefined ? RANKINGS_PAGE_SIZE : parsePositiveInteger(pageSizeValue);

      if (
        !year ||
        year < RANKINGS_MIN_YEAR ||
        year > currentYear ||
        !season ||
        isFutureSeason(year, season, now) ||
        !page ||
        pageSize !== RANKINGS_PAGE_SIZE
      ) {
        throw new ApiError(400, {
          code: "INVALID_RANKINGS_QUERY",
          message: "排行榜参数无效。",
        });
      }

      const workerOrigin = new URL(context.req.url).origin;
      // Settle every month before failing so months already fetched are cached for the next try.
      const results = await Promise.allSettled(
        SEASON_MONTHS[season].map((month) =>
          loadJson(
            context,
            getBangumiSubjectsUrl(
              SUBJECT_TYPE_FILTERS.anime.upstream,
              year,
              RANKINGS_MAX_ITEMS,
              0,
              context.env.BGM_API_URL,
              month,
            ),
            "RANKINGS_UPSTREAM_ERROR",
            (value) => normalizePopularSubjectBatch(value, "anime", workerOrigin),
          ),
        ),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      const batches = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const seenIds = new Set<number>();
      const rankedSubjects = batches
        .flatMap((batch) => batch.data)
        .filter((subject) => {
          if (seenIds.has(subject.id)) return false;
          seenIds.add(subject.id);
          return true;
        })
        .sort((left, right) => (left.rank ?? Infinity) - (right.rank ?? Infinity))
        .slice(0, RANKINGS_MAX_ITEMS);
      const start = (page - 1) * pageSize;
      const fetchedAt = runtime.now();

      if (rankedSubjects.length > 0) {
        const qualifiedSubjects = rankedSubjects
          .filter(
            (subject) => subject.title !== "未命名条目" && subject.rank !== null && !subject.nsfw,
          )
          .map((subject) => ({
            resourceType: "subject" as const,
            externalId: subject.id.toString(),
            discoverySource: "rankings" as const,
            indexStatus: "index" as const,
            indexReason: "rankings_ranked",
          }));

        await recordDiscoveries(
          context.env,
          [
            {
              resourceType: "ranking" as const,
              externalId: `${year}/${season}`,
              discoverySource: "rankings" as const,
              indexStatus: "index" as const,
              indexReason: "rankings_qualified",
            },
            ...qualifiedSubjects,
          ],
          fetchedAt,
        );
      } else {
        await recordDiscoveries(
          context.env,
          [
            {
              resourceType: "ranking" as const,
              externalId: `${year}/${season}`,
              discoverySource: "rankings" as const,
              indexStatus: "noindex" as const,
              indexReason: "empty_rankings",
            },
          ],
          fetchedAt,
        );
      }

      return context.json({
        page,
        pageSize,
        data: rankedSubjects.slice(start, start + pageSize),
        hasPrevious: page > 1,
        hasNext: start + pageSize < rankedSubjects.length,
        total: rankedSubjects.length,
        fetchedAt: fetchedAt.toISOString(),
      });
    },
  );

  app.get(
    "/discover/search/characters",
    jsonCache("discover-search-characters", SEARCH_CACHE_CONTROL),
    async (context) => {
      const { keyword, page, pageSize } = requireSearchQuery(
        context.req.query("keyword"),
        context.req.query("page"),
        context.req.query("pageSize"),
      );
      const offset = (page - 1) * pageSize;
      const workerOrigin = new URL(context.req.url).origin;
      const batch = await loadJson(
        context,
        getBangumiSearchUrl("characters", pageSize, offset, context.env.BGM_API_URL),
        "DISCOVERY_UPSTREAM_ERROR",
        (value) => normalizeCharacterSearchBatch(value, workerOrigin),
        undefined,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword, filter: { nsfw: false } }),
        },
      );
      return context.json(searchPage(batch, page, pageSize, runtime.now()));
    },
  );

  app.get(
    "/discover/search/persons",
    jsonCache("discover-search-persons", SEARCH_CACHE_CONTROL),
    async (context) => {
      const { keyword, page, pageSize } = requireSearchQuery(
        context.req.query("keyword"),
        context.req.query("page"),
        context.req.query("pageSize"),
      );
      const offset = (page - 1) * pageSize;
      const workerOrigin = new URL(context.req.url).origin;
      const batch = await loadJson(
        context,
        getBangumiSearchUrl("persons", pageSize, offset, context.env.BGM_API_URL),
        "DISCOVERY_UPSTREAM_ERROR",
        (value) => normalizePersonSearchBatch(value, workerOrigin),
        undefined,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword, filter: { nsfw: false } }),
        },
      );
      return context.json(searchPage(batch, page, pageSize, runtime.now()));
    },
  );

  app.get(
    "/discover/search/subjects",
    jsonCache("discover-search-subjects", SEARCH_CACHE_CONTROL),
    async (context) => {
      const { keyword, page, pageSize } = requireSearchQuery(
        context.req.query("keyword"),
        context.req.query("page"),
        context.req.query("pageSize"),
      );
      const typeValue = context.req.query("type") ?? "anime";
      const type = Object.hasOwn(SUBJECT_TYPE_FILTERS, typeValue)
        ? (typeValue as keyof typeof SUBJECT_TYPE_FILTERS)
        : null;
      if (!type) {
        throw new ApiError(400, {
          code: "INVALID_DISCOVERY_QUERY",
          message: "发现参数无效。",
        });
      }
      const offset = (page - 1) * pageSize;
      const workerOrigin = new URL(context.req.url).origin;
      const batch = await loadJson(
        context,
        getBangumiSearchUrl("subjects", pageSize, offset, context.env.BGM_API_URL),
        "DISCOVERY_UPSTREAM_ERROR",
        (value) => normalizeSubjectSearchBatch(value, type, workerOrigin),
        undefined,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword,
            sort: "match",
            filter: { type: [SUBJECT_TYPE_FILTERS[type].upstream], nsfw: false },
          }),
        },
      );
      return context.json(searchPage(batch, page, pageSize, runtime.now()));
    },
  );

  app.get(
    "/discover/popular",
    jsonCache("discover-popular", DIRECTORY_COLLECTION_CACHE_CONTROL),
    async (context) => {
      const typeValue = context.req.query("type") ?? "anime";
      const type = Object.hasOwn(SUBJECT_TYPE_FILTERS, typeValue)
        ? (typeValue as keyof typeof SUBJECT_TYPE_FILTERS)
        : null;
      const currentYear = getCurrentYear(runtime.now());
      const yearValue = context.req.query("year");
      const year = yearValue === undefined ? currentYear : parsePositiveInteger(yearValue);
      const pageValue = context.req.query("page");
      const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue);
      const pageSizeValue = context.req.query("pageSize");
      const pageSize =
        pageSizeValue === undefined ? DISCOVERY_PAGE_SIZE : parsePositiveInteger(pageSizeValue);
      if (
        context.req.query("keyword") !== undefined ||
        !type ||
        !year ||
        year > currentYear ||
        !page ||
        page > MAX_DISCOVERY_PAGE ||
        pageSize !== DISCOVERY_PAGE_SIZE
      ) {
        throw new ApiError(400, {
          code: "INVALID_DISCOVERY_QUERY",
          message: "发现参数无效。",
        });
      }

      const workerOrigin = new URL(context.req.url).origin;
      const upstreamPageSize = 50;
      const desiredCount = page * pageSize + 1;
      const subjects = [];
      const seenIds = new Set<number>();
      let offset = 0;
      let exhausted = false;

      while (subjects.length < desiredCount && !exhausted) {
        const batch = await loadJson(
          context,
          getBangumiSubjectsUrl(
            SUBJECT_TYPE_FILTERS[type].upstream,
            year,
            upstreamPageSize,
            offset,
            context.env.BGM_API_URL,
          ),
          "DISCOVERY_UPSTREAM_ERROR",
          (value) => normalizePopularSubjectBatch(value, type, workerOrigin),
        );

        for (const subject of batch.data) {
          if (!seenIds.has(subject.id)) {
            seenIds.add(subject.id);
            subjects.push(subject);
          }
        }

        offset += batch.rawCount;
        exhausted =
          batch.rawCount < upstreamPageSize ||
          batch.rawCount === 0 ||
          (batch.total !== null && offset >= batch.total);
      }

      subjects.sort((left, right) => (left.rank ?? Infinity) - (right.rank ?? Infinity));
      const start = (page - 1) * pageSize;
      const data = subjects.slice(start, start + pageSize);

      const fetchedAt = runtime.now();
      await recordDiscoveries(
        context.env,
        subjects
          .filter(
            (subject) => subject.title !== "未命名条目" && subject.rank !== null && !subject.nsfw,
          )
          .map((subject) => ({
            resourceType: "subject" as const,
            externalId: subject.id.toString(),
            discoverySource: "annual_popular" as const,
            indexStatus: "index" as const,
            indexReason: "annual_popular_ranked",
          })),
        fetchedAt,
      );

      return context.json({
        page,
        pageSize,
        data,
        hasPrevious: page > 1,
        hasNext: subjects.length > start + pageSize,
        fetchedAt: fetchedAt.toISOString(),
      });
    },
  );
}
