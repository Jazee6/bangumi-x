import {
  COLLECTION_PAGE_SIZE,
  RANKINGS_MAX_ITEMS,
  RANKINGS_MIN_YEAR,
  SEASON_LABELS,
  SEASON_MONTHS,
  SEARCH_KEYWORD_MAX_LENGTH,
  SEASON_VALUES,
  getCurrentYear,
  isFutureSeason,
  SUBJECT_TYPE_FILTER_LABELS,
  SUBJECT_TYPE_FILTER_VALUES,
  WEEKDAY_BY_SLUG,
  WEEKDAY_LABELS,
  WEEKDAY_SLUGS,
  type Season,
  type SubjectTypeFilter,
  type WeekdaySlug,
} from "share";

import { ApiError } from "../api-error";
import {
  getBangumiScheduleUrl,
  getBangumiCharacterUrl,
  getBangumiChapterUrl,
  getBangumiPersonUrl,
  getBangumiSubjectsUrl,
  getBangumiSubjectUrl,
} from "../bangumi-api";
import { normalizeChapterDetail } from "../chapter";
import { normalizeCharacterDetail } from "../character";
import { normalizePopularSubjectBatch, SUBJECT_TYPE_FILTERS } from "../discovery";
import {
  BRAND_OG_CARD,
  OG_CACHE_CONTROL,
  OG_FAILURE_CACHE_CONTROL,
  OG_TEMPLATE_VERSION,
  createOgCacheRequest,
  getDefaultOgCache,
  renderOgImage,
  type OgCard,
} from "../og";
import { normalizePersonDetail } from "../person";
import { getProxiedImageUrl } from "../poster";
import { normalizeSchedule } from "../schedule";
import { normalizeSubject } from "../subject";
import { parsePositiveInteger } from "../validation";
import type { AnonymousApp, AnonymousContext, AnonymousKit, AnonymousBindings } from "./kit";

export function registerOgRoutes(app: AnonymousApp, kit: AnonymousKit) {
  const { runtime, loadJson, requireId } = kit;

  function invalidOgQuery() {
    return new Response(
      JSON.stringify({ code: "INVALID_OG_QUERY", message: "分享卡片参数无效。" }),
      {
        status: 400,
        headers: {
          "Cache-Control": OG_FAILURE_CACHE_CONTROL,
          "Content-Type": "application/json; charset=UTF-8",
        },
      },
    );
  }

  interface OgRequest {
    url: string;
    ifNoneMatch: string | undefined;
    webOrigin: string;
    miniFormat?: "friend" | "timeline";
  }

  interface DeferredOgCard {
    cacheKey: string;
    load: () => Promise<OgCard>;
  }

  function parseOgUrl(requestUrl: string): URL | null {
    const url = new URL(requestUrl);
    if (url.searchParams.size === 0) return url;
    return url.searchParams.size === 1 &&
      ["friend", "timeline"].includes(url.searchParams.get("mini") ?? "")
      ? url
      : null;
  }

  async function ogResponse(
    source: OgCard | DeferredOgCard,
    request: OgRequest,
  ): Promise<Response> {
    const cacheKey = `${source.cacheKey}${request.miniFormat ? `-mini-${request.miniFormat}` : ""}`;
    const etag = `W/"${OG_TEMPLATE_VERSION}-${cacheKey}"`;
    const imageHeaders = {
      "Cache-Control": OG_CACHE_CONTROL,
      "Content-Type": "image/png",
      ETag: etag,
      "X-OG-Template-Version": OG_TEMPLATE_VERSION,
    };
    if (request.ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: imageHeaders });
    }

    const cache = runtime.ogCache ?? getDefaultOgCache();
    const cacheRequest = createOgCacheRequest(request.url, cacheKey);
    const cached = await cache?.match(cacheRequest);
    if (cached) return cached;

    try {
      const card = "load" in source ? await source.load() : source;
      const result = await (runtime.renderOgImage ?? renderOgImage)(card, {
        fetch: runtime.fetch,
        cacheOrigin: new URL(request.url).origin,
        cache,
        miniFormat: request.miniFormat,
      });
      const body = result.bytes.buffer.slice(
        result.bytes.byteOffset,
        result.bytes.byteOffset + result.bytes.byteLength,
      ) as ArrayBuffer;
      const response = new Response(body, {
        headers: result.cacheable
          ? imageHeaders
          : {
              "Cache-Control": OG_FAILURE_CACHE_CONTROL,
              "Content-Type": "image/png",
              "X-OG-Fallback": "brand",
              "X-OG-Template-Version": OG_TEMPLATE_VERSION,
            },
      });
      if (result.cacheable) await cache?.put(cacheRequest, response.clone());
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Open Graph image rendering failed", error);
      if (request.miniFormat) {
        try {
          const fallback = await renderOgImage(BRAND_OG_CARD, {
            fetch: runtime.fetch,
            cacheOrigin: new URL(request.url).origin,
            cache,
            miniFormat: request.miniFormat,
          });
          return new Response(fallback.bytes as BodyInit, {
            headers: {
              "Cache-Control": OG_FAILURE_CACHE_CONTROL,
              "Content-Type": "image/png",
              "X-OG-Fallback": "mini-brand",
            },
          });
        } catch (fallbackError) {
          console.error("Mini brand image rendering failed", fallbackError);
        }
      }
      const fallbackUrl = new URL("/og-brand.png", request.webOrigin);
      return new Response(null, {
        status: 307,
        headers: {
          "Cache-Control": OG_FAILURE_CACHE_CONTROL,
          Location: fallbackUrl.toString(),
        },
      });
    }
  }

  function ogRequest(context: {
    req: { url: string; header: (name: string) => string | undefined };
    env: AnonymousBindings;
  }): OgRequest {
    return {
      url: context.req.url,
      ifNoneMatch: context.req.header("If-None-Match"),
      webOrigin: context.env.WEB_ORIGIN,
      miniFormat: (new URL(context.req.url).searchParams.get("mini") ?? undefined) as
        | "friend"
        | "timeline"
        | undefined,
    };
  }

  function selectOgImageUrls(
    items: readonly { imageUrl?: string | null; nsfw?: boolean }[],
  ): string[] {
    return items
      .filter((item) => !item.nsfw && item.imageUrl)
      .slice(0, 3)
      .map((item) => item.imageUrl as string);
  }

  async function optionalOgImageUrls(load: () => Promise<string[]>): Promise<string[]> {
    try {
      return await load();
    } catch {
      return [];
    }
  }

  app.get("/og/mini-search/:tab", async (context) => {
    const url = new URL(context.req.url);
    const tab = context.req.param("tab");
    const keyword = url.searchParams.get("keyword")?.trim() ?? "";
    if (
      !["subjects", "characters", "persons"].includes(tab) ||
      !["friend", "timeline"].includes(url.searchParams.get("mini") ?? "") ||
      url.searchParams.size !== 2 ||
      !keyword ||
      Array.from(keyword).length > SEARCH_KEYWORD_MAX_LENGTH
    )
      return invalidOgQuery();
    return ogResponse(
      {
        cacheKey: `mini-search-${tab}-${encodeURIComponent(keyword)}`,
        title: `搜索「${keyword}」`,
        type: "发现",
        badges: [
          ({ subjects: "条目", characters: "角色", persons: "人物" } as Record<string, string>)[
            tab
          ] ?? "",
        ],
      },
      ogRequest(context),
    );
  });

  app.get("/og/brand", async (context) => {
    if (!parseOgUrl(context.req.url)) return invalidOgQuery();
    return ogResponse(BRAND_OG_CARD, ogRequest(context));
  });

  app.get("/og/schedule/:weekday", async (context) => {
    if (!parseOgUrl(context.req.url)) return invalidOgQuery();
    const value = context.req.param("weekday");
    if (!WEEKDAY_SLUGS.includes(value as WeekdaySlug)) return invalidOgQuery();
    const weekday = value as WeekdaySlug;
    const label = WEEKDAY_LABELS[WEEKDAY_BY_SLUG[weekday]];
    const cacheKey = `schedule-${weekday}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => ({
          cacheKey,
          title: "每日放送",
          type: "",
          badges: [label],
          imageUrls: await optionalOgImageUrls(async () => {
            const workerOrigin = new URL(context.req.url).origin;
            const schedule = await loadJson(
              context,
              getBangumiScheduleUrl(context.env.BGM_API_URL),
              "BANGUMI_UPSTREAM_ERROR",
              (input) => normalizeSchedule(input, workerOrigin),
            );
            const items =
              schedule.days.find((day) => day.weekday === WEEKDAY_BY_SLUG[weekday])?.items ?? [];
            const subjects = await Promise.all(
              items.slice(0, 6).map(async (item) => {
                try {
                  return await loadOgSubject(context, item.id, workerOrigin, context.env);
                } catch {
                  return null;
                }
              }),
            );
            return selectOgImageUrls(subjects.filter((subject) => subject !== null));
          }),
          mediaLayout: "stack",
        }),
      },
      ogRequest(context),
    );
  });

  app.get("/og/discover/:type", async (context) => {
    if (!parseOgUrl(context.req.url)) return invalidOgQuery();
    const value = context.req.param("type");
    if (!SUBJECT_TYPE_FILTER_VALUES.includes(value as SubjectTypeFilter)) {
      return invalidOgQuery();
    }
    const type = value as SubjectTypeFilter;
    const year = getCurrentYear(runtime.now());
    const label = SUBJECT_TYPE_FILTER_LABELS[type];
    const cacheKey = `discover-${year}-${type}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => ({
          cacheKey,
          title: `${label}本年度热门`,
          type: "发现",
          badges: [`${year} 年`, label],
          imageUrls: await optionalOgImageUrls(async () => {
            const workerOrigin = new URL(context.req.url).origin;
            const batch = await loadJson(
              context,
              getBangumiSubjectsUrl(
                SUBJECT_TYPE_FILTERS[type].upstream,
                year,
                50,
                0,
                context.env.BGM_API_URL,
              ),
              "DISCOVERY_UPSTREAM_ERROR",
              (input) => normalizePopularSubjectBatch(input, type, workerOrigin),
            );
            return selectOgImageUrls(
              [...batch.data].sort(
                (left, right) => (left.rank ?? Infinity) - (right.rank ?? Infinity),
              ),
            );
          }),
          mediaLayout: "stack",
        }),
      },
      ogRequest(context),
    );
  });

  app.get("/og/rankings/:year/:season", async (context) => {
    if (!parseOgUrl(context.req.url)) return invalidOgQuery();
    const now = runtime.now();
    const year = parsePositiveInteger(context.req.param("year"));
    const seasonValue = context.req.param("season");
    const season = SEASON_VALUES.includes(seasonValue as Season) ? (seasonValue as Season) : null;
    if (
      !year ||
      year < RANKINGS_MIN_YEAR ||
      year > getCurrentYear(now) ||
      !season ||
      isFutureSeason(year, season, now)
    ) {
      return invalidOgQuery();
    }
    const seasonLabel = SEASON_LABELS[season];
    const cacheKey = `rankings-${year}-${season}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => ({
          cacheKey,
          title: `${year} 年${seasonLabel}排行榜`,
          type: "排行榜",
          badges: [`${year} 年`, seasonLabel, "动画"],
          imageUrls: await optionalOgImageUrls(async () => {
            const workerOrigin = new URL(context.req.url).origin;
            const batches = await Promise.all(
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
                  (input) => normalizePopularSubjectBatch(input, "anime", workerOrigin),
                ),
              ),
            );
            const seenIds = new Set<number>();
            return selectOgImageUrls(
              batches
                .flatMap((batch) => batch.data)
                .filter((subject) => {
                  if (seenIds.has(subject.id)) return false;
                  seenIds.add(subject.id);
                  return true;
                })
                .sort((left, right) => (left.rank ?? Infinity) - (right.rank ?? Infinity)),
            );
          }),
          mediaLayout: "stack",
        }),
      },
      ogRequest(context),
    );
  });

  function subjectOgCard(subject: ReturnType<typeof normalizeSubject>, cacheKey: string): OgCard {
    const badges = [
      subject.platform,
      subject.rank ? `#${subject.rank}` : null,
      subject.date,
      subject.totalChapters ? `全 ${subject.totalChapters} 话` : null,
    ].filter((badge): badge is string => badge !== null);
    return {
      cacheKey,
      title: subject.title,
      type: subject.type,
      badges,
      imageUrls: subject.imageUrl ? [subject.imageUrl] : [],
      score: subject.score,
      sensitive: subject.nsfw,
    };
  }

  async function loadOgSubject(
    context: AnonymousContext,
    subjectId: number,
    workerOrigin: string,
    bindings: AnonymousBindings,
  ) {
    return loadJson(
      context,
      getBangumiSubjectUrl(subjectId, bindings.BGM_API_URL),
      "SUBJECT_UPSTREAM_ERROR",
      (value) => normalizeSubject(value, workerOrigin),
      { code: "SUBJECT_NOT_FOUND", message: "条目不存在。" },
    );
  }

  app.get("/og/subjects/:subjectId", async (context) => {
    const url = parseOgUrl(context.req.url);
    if (!url) return invalidOgQuery();
    const subjectId = requireId(
      context.req.param("subjectId"),
      "INVALID_SUBJECT_ID",
      "条目 ID 无效。",
    );
    const cacheKey = `subject-${subjectId}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => {
          const subject = await loadOgSubject(context, subjectId, url.origin, context.env);
          return subjectOgCard(subject, cacheKey);
        },
      },
      ogRequest(context),
    );
  });

  app.get("/og/subjects/:subjectId/:view", async (context) => {
    const url = parseOgUrl(context.req.url);
    if (!url) return invalidOgQuery();
    const views = ["chapters", "characters", "persons"] as const;
    const viewValue = context.req.param("view");
    if (!views.includes(viewValue as (typeof views)[number])) return invalidOgQuery();
    const subjectId = requireId(
      context.req.param("subjectId"),
      "INVALID_SUBJECT_ID",
      "条目 ID 无效。",
    );
    const cacheKey = `subject-${subjectId}-${viewValue}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => {
          const subject = await loadOgSubject(context, subjectId, url.origin, context.env);
          return subjectOgCard(subject, cacheKey);
        },
      },
      ogRequest(context),
    );
  });

  app.get("/og/chapters/:chapterId", async (context) => {
    const url = parseOgUrl(context.req.url);
    if (!url) return invalidOgQuery();
    const chapterId = requireId(
      context.req.param("chapterId"),
      "INVALID_CHAPTER_ID",
      "章节 ID 无效。",
    );
    const cacheKey = `chapter-${chapterId}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => {
          const workerOrigin = url.origin;
          const chapter = await loadJson(
            context,
            getBangumiChapterUrl(chapterId, context.env.BGM_API_URL),
            "CHAPTER_UPSTREAM_ERROR",
            normalizeChapterDetail,
            { code: "CHAPTER_NOT_FOUND", message: "章节不存在。" },
          );
          const subject = await loadOgSubject(
            context,
            chapter.subjectId,
            workerOrigin,
            context.env,
          );
          const badges = [chapter.date, chapter.duration].filter(
            (badge): badge is string => badge !== null,
          );
          return {
            cacheKey,
            title: chapter.title,
            type: "章节",
            context: subject.title,
            badges,
            imageUrls: subject.imageUrl ? [subject.imageUrl] : [],
            sensitive: subject.nsfw,
          };
        },
      },
      ogRequest(context),
    );
  });

  app.get("/og/characters/:characterId", async (context) => {
    const url = parseOgUrl(context.req.url);
    if (!url) return invalidOgQuery();
    const characterId = requireId(
      context.req.param("characterId"),
      "INVALID_CHARACTER_ID",
      "角色 ID 无效。",
    );
    const cacheKey = `character-${characterId}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => {
          const character = await loadJson(
            context,
            getBangumiCharacterUrl(characterId, context.env.BGM_API_URL),
            "CHARACTER_UPSTREAM_ERROR",
            (value) => normalizeCharacterDetail(value, url.origin),
            { code: "CHARACTER_NOT_FOUND", message: "角色不存在。" },
          );
          const badges = [character.gender, character.birthday, character.bloodType]
            .filter((badge): badge is string => badge !== null)
            .slice(0, 2);
          return {
            cacheKey,
            title: character.name,
            type: character.type,
            badges,
            imageUrls: character.imageUrl ? [character.imageUrl] : [],
          };
        },
      },
      ogRequest(context),
    );
  });

  app.get("/og/persons/:personId", async (context) => {
    const url = parseOgUrl(context.req.url);
    if (!url) return invalidOgQuery();
    const personId = requireId(
      context.req.param("personId"),
      "INVALID_PERSON_ID",
      "人物 ID 无效。",
    );
    const cacheKey = `person-${personId}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => {
          const person = await loadJson(
            context,
            getBangumiPersonUrl(personId, context.env.BGM_API_URL),
            "PERSON_UPSTREAM_ERROR",
            (value) => normalizePersonDetail(value, url.origin),
            { code: "PERSON_NOT_FOUND", message: "人物不存在。" },
          );
          const badges = [
            person.careers.length > 0 ? person.careers.join("、") : null,
            person.gender,
            person.birthday,
          ]
            .filter((badge): badge is string => badge !== null)
            .slice(0, 2);
          return {
            cacheKey,
            title: person.name,
            type: person.type,
            badges,
            imageUrls: person.imageUrl ? [person.imageUrl] : [],
          };
        },
      },
      ogRequest(context),
    );
  });

  app.get("/og/collection-lists/:shareId", async (context) => {
    const url = parseOgUrl(context.req.url);
    const shareId = context.req.param("shareId");
    if (!url || !shareId || shareId.length > 128) return invalidOgQuery();
    const cacheKey = `collection-list-${shareId}`;
    return ogResponse(
      {
        cacheKey,
        load: async () => {
          const repository = runtime.collections?.(context.env);
          if (!repository) {
            throw new ApiError(503, {
              code: "INTERNAL_SERVER_ERROR",
              message: "公开收藏列表暂时无法加载。",
            });
          }
          const result = await repository.getPublicCollectionList(shareId, COLLECTION_PAGE_SIZE, 0);
          if (!result) {
            throw new ApiError(404, {
              code: "PUBLIC_COLLECTION_LIST_NOT_FOUND",
              message: "收藏列表不可访问。",
            });
          }
          const imageUrls = result.data
            .filter((item) => !item.nsfw)
            .map((item) => getProxiedImageUrl(item.posterSourceUrl, url.origin))
            .filter((imageUrl): imageUrl is string => imageUrl !== null)
            .slice(0, 3);
          return {
            cacheKey,
            title: result.list.name,
            type: "公开收藏列表",
            context: `由 ${result.ownerName} 创建`,
            badges: [`${result.total} 个条目`],
            imageUrls,
            mediaLayout: "stack",
          };
        },
      },
      ogRequest(context),
    );
  });
}
