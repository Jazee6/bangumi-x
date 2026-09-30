import type { DirectoryIndexStatus } from "share";

import { ApiError } from "../api-error";
import {
  getBangumiCharacterPersonsUrl,
  getBangumiCharacterSubjectsUrl,
  getBangumiCharacterUrl,
  getBangumiChapterUrl,
  getBangumiChaptersUrl,
  getBangumiPersonCharactersUrl,
  getBangumiPersonSubjectsUrl,
  getBangumiPersonUrl,
  getBangumiSubjectCharactersUrl,
  getBangumiSubjectPersonsUrl,
  getBangumiSubjectUrl,
} from "../bangumi-api";
import {
  createBroadcastSnapshotLoader,
  isBroadcastSnapshotStale,
  toSubjectBroadcast,
  type BroadcastRepository,
} from "../broadcast";
import { normalizeChapterDetail, normalizeChapterPage } from "../chapter";
import {
  normalizeCharacterDetail,
  normalizeCharacterRelatedPersons,
  normalizeCharacterRelatedSubjects,
  normalizeSubjectCharacters,
} from "../character";
import type { DirectoryDiscovery } from "../directory";
import {
  normalizePersonDetail,
  normalizePersonRelatedCharacters,
  normalizePersonRelatedSubjects,
  normalizeSubjectPersons,
} from "../person";
import { normalizeSubject } from "../subject";
import { normalizeSubjectSnapshot } from "../subject-snapshot";
import type { UpstreamPriority } from "../upstream-client";
import { parseNonNegativeInteger, parsePositiveInteger } from "../validation";
import {
  JSON_CACHE_CONTROL,
  type AnonymousApp,
  type AnonymousContext,
  type AnonymousKit,
  relatedSubjectDiscoveries,
  subjectIndexDecision,
} from "./kit";

const ENTITY_CACHE_CONTROL = "public, max-age=86400";

export function registerEntityRoutes(app: AnonymousApp, kit: AnonymousKit) {
  const {
    runtime,
    upstream,
    waitUntil,
    upstreamOptions,
    loadJson,
    jsonCache,
    requireId,
    recordNotFoundOn404,
    recordDiscoveries,
  } = kit;

  const loadBroadcastSnapshot = createBroadcastSnapshotLoader(upstream);

  async function resolveSubjectBroadcast(
    context: AnonymousContext,
    subject: { id: number; type: string; totalChapters: number | null },
  ) {
    if (subject.type !== "动画" && subject.type !== "三次元") return null;

    let repository: BroadcastRepository | undefined;
    try {
      repository = runtime.broadcasts?.(context.env);
    } catch {
      return null;
    }
    if (!repository) return null;

    let existing;
    try {
      existing = await repository.get(subject.id);
    } catch {
      return null;
    }
    const now = runtime.now();
    const refresh = async (priority: UpstreamPriority) => {
      const snapshot = await loadBroadcastSnapshot({
        subjectId: subject.id,
        plannedChapters: subject.totalChapters,
        apiUrl: context.env.BGM_API_URL,
        now: runtime.now(),
        upstream: upstreamOptions(context, priority),
      });
      await repository.upsert(snapshot);
      return snapshot;
    };

    if (existing) {
      if (isBroadcastSnapshotStale(existing, now)) {
        waitUntil(context)?.(
          refresh("background")
            .then(() => undefined)
            .catch(() => undefined),
        );
      }
      return toSubjectBroadcast(existing, now);
    }

    try {
      return toSubjectBroadcast(await refresh("foreground"), now);
    } catch {
      return null;
    }
  }

  app.get(
    "/subjects/:subjectId/chapters",
    jsonCache("chapters", ENTITY_CACHE_CONTROL),
    async (context) => {
      const subjectId = requireId(
        context.req.param("subjectId"),
        "INVALID_SUBJECT_ID",
        "条目 ID 无效。",
      );
      const limitValue = context.req.query("limit");
      const offsetValue = context.req.query("offset");
      const limit = limitValue === undefined ? 50 : parsePositiveInteger(limitValue);
      const offset = offsetValue === undefined ? 0 : parseNonNegativeInteger(offsetValue);
      if (!limit || limit > 200 || offset === null) {
        throw new ApiError(400, { code: "INVALID_PAGINATION", message: "分页参数无效。" });
      }

      const page = await loadJson(
        context,
        getBangumiChaptersUrl(subjectId, limit, offset, context.env.BGM_API_URL),
        "CHAPTER_UPSTREAM_ERROR",
        (value) => normalizeChapterPage(value, limit, offset),
        { code: "SUBJECT_NOT_FOUND", message: "条目不存在。" },
      );
      const fetchedAt = runtime.now();
      return context.json({ ...page, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/subjects/:subjectId/persons",
    jsonCache("subject-persons", ENTITY_CACHE_CONTROL),
    async (context) => {
      const subjectId = requireId(
        context.req.param("subjectId"),
        "INVALID_SUBJECT_ID",
        "条目 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const persons = await loadJson(
        context,
        getBangumiSubjectPersonsUrl(subjectId, context.env.BGM_API_URL),
        "PERSON_UPSTREAM_ERROR",
        (value) => normalizeSubjectPersons(value, workerOrigin),
        { code: "SUBJECT_NOT_FOUND", message: "条目不存在。" },
      );
      const fetchedAt = runtime.now();
      return context.json({ ...persons, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/subjects/:subjectId/characters",
    jsonCache("subject-characters", ENTITY_CACHE_CONTROL),
    async (context) => {
      const subjectId = requireId(
        context.req.param("subjectId"),
        "INVALID_SUBJECT_ID",
        "条目 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const characters = await loadJson(
        context,
        getBangumiSubjectCharactersUrl(subjectId, context.env.BGM_API_URL),
        "CHARACTER_UPSTREAM_ERROR",
        (value) => normalizeSubjectCharacters(value, workerOrigin),
        { code: "SUBJECT_NOT_FOUND", message: "条目不存在。" },
      );
      const fetchedAt = runtime.now();
      return context.json({ ...characters, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/subjects/:subjectId",
    jsonCache("subjects-with-broadcast", JSON_CACHE_CONTROL),
    async (context) => {
      const subjectId = requireId(
        context.req.param("subjectId"),
        "INVALID_SUBJECT_ID",
        "条目 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const loaded = await recordNotFoundOn404(
        loadJson(
          context,
          getBangumiSubjectUrl(subjectId, context.env.BGM_API_URL),
          "SUBJECT_UPSTREAM_ERROR",
          (value) => ({
            subject: normalizeSubject(value, workerOrigin),
            snapshot: { ...normalizeSubjectSnapshot(value), updatedAt: runtime.now() },
          }),
          { code: "SUBJECT_NOT_FOUND", message: "条目不存在。" },
        ),
        context.env,
        "subject",
        subjectId.toString(),
      );
      if (runtime.updateSubjectSnapshot) {
        await runtime.updateSubjectSnapshot(context.env, loaded.snapshot).catch(() => false);
      }
      const broadcast = await resolveSubjectBroadcast(context, loaded.subject);
      const fetchedAt = runtime.now();
      await recordDiscoveries(
        context.env,
        [
          {
            resourceType: "subject",
            externalId: loaded.subject.id.toString(),
            discoverySource: "direct_access",
            ...subjectIndexDecision(loaded.subject),
          },
        ],
        fetchedAt,
      );
      return context.json({
        ...loaded.subject,
        broadcast,
        fetchedAt: fetchedAt.toISOString(),
      });
    },
  );

  app.get(
    "/chapters/:chapterId",
    jsonCache("chapter-details", ENTITY_CACHE_CONTROL),
    async (context) => {
      const chapterId = requireId(
        context.req.param("chapterId"),
        "INVALID_CHAPTER_ID",
        "章节 ID 无效。",
      );
      const chapter = await recordNotFoundOn404(
        loadJson(
          context,
          getBangumiChapterUrl(chapterId, context.env.BGM_API_URL),
          "CHAPTER_UPSTREAM_ERROR",
          normalizeChapterDetail,
          { code: "CHAPTER_NOT_FOUND", message: "章节不存在。" },
        ),
        context.env,
        "chapter",
        chapterId.toString(),
      );
      const fetchedAt = runtime.now();
      const workerOrigin = new URL(context.req.url).origin;
      const subject = await loadJson(
        context,
        getBangumiSubjectUrl(chapter.subjectId, context.env.BGM_API_URL),
        "SUBJECT_UPSTREAM_ERROR",
        (value) => normalizeSubject(value, workerOrigin),
        { code: "SUBJECT_NOT_FOUND", message: "条目不存在。" },
      );

      const isUnnamed = chapter.title === "未命名章节";
      const isThin = !chapter.summary?.trim() && !chapter.date?.trim();
      const isSubjectNsfw = subject.nsfw;

      const chapterStatus: DirectoryIndexStatus =
        isUnnamed || isThin || isSubjectNsfw ? "noindex" : "index";
      const indexReason = isUnnamed
        ? "unnamed"
        : isSubjectNsfw
          ? "nsfw_subject"
          : isThin
            ? "thin_chapter"
            : "chapter_verified";

      const discoveries: DirectoryDiscovery[] = [
        {
          resourceType: "chapter",
          externalId: chapter.id.toString(),
          discoverySource: "direct_access",
          indexStatus: chapterStatus,
          indexReason,
        },
      ];
      discoveries.push({
        resourceType: "subject",
        externalId: subject.id.toString(),
        discoverySource: "relation",
        ...subjectIndexDecision(subject),
      });

      await recordDiscoveries(context.env, discoveries, fetchedAt);

      const { subjectId: _subjectId, ...chapterDetail } = chapter;
      return context.json({
        ...chapterDetail,
        subject: {
          id: subject.id,
          title: subject.title,
          type: subject.type,
          nsfw: subject.nsfw,
          imageUrl: subject.imageUrl,
        },
        fetchedAt: fetchedAt.toISOString(),
      });
    },
  );

  app.get(
    "/persons/:personId/subjects",
    jsonCache("person-subjects", ENTITY_CACHE_CONTROL),
    async (context) => {
      const personId = requireId(
        context.req.param("personId"),
        "INVALID_PERSON_ID",
        "人物 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const subjects = await loadJson(
        context,
        getBangumiPersonSubjectsUrl(personId, context.env.BGM_API_URL),
        "PERSON_UPSTREAM_ERROR",
        (value) => normalizePersonRelatedSubjects(value, workerOrigin),
        { code: "PERSON_NOT_FOUND", message: "人物不存在。" },
      );
      const fetchedAt = runtime.now();
      await recordDiscoveries(
        context.env,
        relatedSubjectDiscoveries(subjects.groups.flatMap((group) => group.items)),
        fetchedAt,
      );
      return context.json({ ...subjects, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/persons/:personId/characters",
    jsonCache("person-characters", ENTITY_CACHE_CONTROL),
    async (context) => {
      const personId = requireId(
        context.req.param("personId"),
        "INVALID_PERSON_ID",
        "人物 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const characters = await loadJson(
        context,
        getBangumiPersonCharactersUrl(personId, context.env.BGM_API_URL),
        "PERSON_UPSTREAM_ERROR",
        (value) => normalizePersonRelatedCharacters(value, workerOrigin),
        { code: "PERSON_NOT_FOUND", message: "人物不存在。" },
      );
      const fetchedAt = runtime.now();
      return context.json({ ...characters, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/persons/:personId",
    jsonCache("person-details", ENTITY_CACHE_CONTROL),
    async (context) => {
      const personId = requireId(
        context.req.param("personId"),
        "INVALID_PERSON_ID",
        "人物 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const person = await recordNotFoundOn404(
        loadJson(
          context,
          getBangumiPersonUrl(personId, context.env.BGM_API_URL),
          "PERSON_UPSTREAM_ERROR",
          (value) => normalizePersonDetail(value, workerOrigin),
          { code: "PERSON_NOT_FOUND", message: "人物不存在。" },
        ),
        context.env,
        "person",
        personId.toString(),
      );
      let hasSubjectRelation = false;
      if (person.name !== "未命名人物" && !person.summary?.trim()) {
        const subjects = await loadJson(
          context,
          getBangumiPersonSubjectsUrl(personId, context.env.BGM_API_URL),
          "PERSON_UPSTREAM_ERROR",
          (value) => normalizePersonRelatedSubjects(value, workerOrigin),
          { code: "PERSON_NOT_FOUND", message: "人物不存在。" },
        );
        hasSubjectRelation = subjects.total > 0;
      }
      const fetchedAt = runtime.now();
      const indexStatus =
        person.name !== "未命名人物" && (Boolean(person.summary?.trim()) || hasSubjectRelation)
          ? "index"
          : "noindex";
      await recordDiscoveries(
        context.env,
        [
          {
            resourceType: "person",
            externalId: person.id.toString(),
            discoverySource: "direct_access",
            indexStatus,
            indexReason:
              person.name === "未命名人物"
                ? "unnamed"
                : indexStatus === "index"
                  ? "person_verified"
                  : "thin_person",
          },
        ],
        fetchedAt,
      );
      return context.json({ ...person, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/characters/:characterId/subjects",
    jsonCache("character-subjects", ENTITY_CACHE_CONTROL),
    async (context) => {
      const characterId = requireId(
        context.req.param("characterId"),
        "INVALID_CHARACTER_ID",
        "角色 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const subjects = await loadJson(
        context,
        getBangumiCharacterSubjectsUrl(characterId, context.env.BGM_API_URL),
        "CHARACTER_UPSTREAM_ERROR",
        (value) => normalizeCharacterRelatedSubjects(value, workerOrigin),
        { code: "CHARACTER_NOT_FOUND", message: "角色不存在。" },
      );
      const fetchedAt = runtime.now();
      await recordDiscoveries(
        context.env,
        relatedSubjectDiscoveries(subjects.groups.flatMap((group) => group.items)),
        fetchedAt,
      );
      return context.json({ ...subjects, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/characters/:characterId/persons",
    jsonCache("character-persons", ENTITY_CACHE_CONTROL),
    async (context) => {
      const characterId = requireId(
        context.req.param("characterId"),
        "INVALID_CHARACTER_ID",
        "角色 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const persons = await loadJson(
        context,
        getBangumiCharacterPersonsUrl(characterId, context.env.BGM_API_URL),
        "CHARACTER_UPSTREAM_ERROR",
        (value) => normalizeCharacterRelatedPersons(value, workerOrigin),
        { code: "CHARACTER_NOT_FOUND", message: "角色不存在。" },
      );
      const fetchedAt = runtime.now();
      return context.json({ ...persons, fetchedAt: fetchedAt.toISOString() });
    },
  );

  app.get(
    "/characters/:characterId",
    jsonCache("character-details", ENTITY_CACHE_CONTROL),
    async (context) => {
      const characterId = requireId(
        context.req.param("characterId"),
        "INVALID_CHARACTER_ID",
        "角色 ID 无效。",
      );
      const workerOrigin = new URL(context.req.url).origin;
      const character = await recordNotFoundOn404(
        loadJson(
          context,
          getBangumiCharacterUrl(characterId, context.env.BGM_API_URL),
          "CHARACTER_UPSTREAM_ERROR",
          (value) => normalizeCharacterDetail(value, workerOrigin),
          { code: "CHARACTER_NOT_FOUND", message: "角色不存在。" },
        ),
        context.env,
        "character",
        characterId.toString(),
      );
      let hasSubjectRelation = false;
      if (character.name !== "未命名角色" && !character.summary?.trim()) {
        const subjects = await loadJson(
          context,
          getBangumiCharacterSubjectsUrl(characterId, context.env.BGM_API_URL),
          "CHARACTER_UPSTREAM_ERROR",
          (value) => normalizeCharacterRelatedSubjects(value, workerOrigin),
          { code: "CHARACTER_NOT_FOUND", message: "角色不存在。" },
        );
        hasSubjectRelation = subjects.total > 0;
      }
      const fetchedAt = runtime.now();
      const indexStatus =
        character.name !== "未命名角色" &&
        (Boolean(character.summary?.trim()) || hasSubjectRelation)
          ? "index"
          : "noindex";
      await recordDiscoveries(
        context.env,
        [
          {
            resourceType: "character",
            externalId: character.id.toString(),
            discoverySource: "direct_access",
            indexStatus,
            indexReason:
              character.name === "未命名角色"
                ? "unnamed"
                : indexStatus === "index"
                  ? "character_verified"
                  : "thin_character",
          },
        ],
        fetchedAt,
      );
      return context.json({ ...character, fetchedAt: fetchedAt.toISOString() });
    },
  );
}
