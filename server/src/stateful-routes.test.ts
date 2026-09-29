import { beforeEach, vi, describe, expect, test } from "vitest";
import { v7 as uuidv7 } from "uuid";

import type { ProgressStage } from "share";

import { createMemoryDirectoryRepository } from "./directory";
import { createApp } from "./index";

import type { AuthBoundary } from "./auth";
import type {
  CollectionRepository,
  ContentVisibilityFilters,
  PersonalRecordFilters,
  ProgressRecordFilters,
  StoredCollectionItem,
  StoredProgressItem,
  StoredProgressPage,
  StoredProgressRecord,
  StoredPublicCollectionListPage,
  SubjectSnapshotRecord,
} from "./collections";

const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
  SERVER_URL: "https://server.example.test",
};

class MemoryCollections implements CollectionRepository {
  snapshots = new Map<number, SubjectSnapshotRecord>();
  records = new Map<string, Date>();
  progress = new Map<
    string,
    {
      id: string;
      userId: string;
      subjectId: number;
      stage: ProgressStage;
      completedChapters: number | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  lists = new Map<
    string,
    {
      id: string;
      userId: string;
      name: string;
      isPublic: boolean;
      shareToken: string;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  members = new Map<string, Date>();

  key(userId: string, subjectId: number) {
    return `${userId}:${subjectId}`;
  }

  async getSnapshot(subjectId: number) {
    return this.snapshots.get(subjectId) ?? null;
  }

  async getCollection(userId: string, subjectId: number): Promise<StoredCollectionItem | null> {
    const collectedAt = this.records.get(this.key(userId, subjectId));
    const snapshot = this.snapshots.get(subjectId);
    const p = this.progress.get(this.key(userId, subjectId));
    return collectedAt && snapshot
      ? {
          ...snapshot,
          collectedAt,
          progress: p
            ? {
                stage: p.stage,
                completedChapters: p.completedChapters,
                totalChapters: snapshot.totalChapters,
                updatedAt: p.updatedAt.toISOString(),
              }
            : null,
        }
      : null;
  }

  async listCollections(
    userId: string,
    limit: number,
    offset: number,
    filters: PersonalRecordFilters = {},
  ) {
    const data: StoredCollectionItem[] = [...this.records]
      .flatMap(([key, collectedAt]) => {
        const [owner, id] = key.split(":");
        const subjectId = Number(id);
        const snapshot = this.snapshots.get(subjectId);
        const p = this.progress.get(key);
        const listIds = snapshot
          ? [...this.members.keys()]
              .filter((memberKey) => memberKey.endsWith(`:${subjectId}`))
              .map((memberKey) => memberKey.slice(0, memberKey.lastIndexOf(":")))
              .filter((listId) => this.lists.get(listId)?.userId === userId)
          : [];
        return owner === userId && snapshot
          ? [
              {
                ...snapshot,
                collectedAt,
                progress: p
                  ? {
                      stage: p.stage,
                      completedChapters: p.completedChapters,
                      totalChapters: snapshot.totalChapters,
                      updatedAt: p.updatedAt.toISOString(),
                    }
                  : null,
                listIds,
              },
            ]
          : [];
      })
      .filter(
        (item) =>
          !filters.list ||
          (filters.list === "unlisted"
            ? item.listIds.length === 0
            : item.listIds.includes(filters.list)),
      )
      .filter((item) => !filters.excludeNsfw || !item.nsfw)
      .filter((item) => !filters.type || item.type === filters.type)
      .filter(
        (item) =>
          !filters.keyword ||
          item.title.toLocaleLowerCase().includes(filters.keyword.toLocaleLowerCase()),
      )
      .sort((left, right) => {
        const leftTime =
          filters.list && filters.list !== "unlisted"
            ? this.members.get(`${filters.list}:${left.subjectId}`)
            : left.collectedAt;
        const rightTime =
          filters.list && filters.list !== "unlisted"
            ? this.members.get(`${filters.list}:${right.subjectId}`)
            : right.collectedAt;
        return (
          (rightTime?.getTime() ?? 0) - (leftTime?.getTime() ?? 0) ||
          right.subjectId - left.subjectId
        );
      });
    return { data: data.slice(offset, offset + limit), total: data.length };
  }

  async removeCollection(userId: string, subjectId: number, updatedAt: Date) {
    this.records.delete(this.key(userId, subjectId));
    for (const key of this.members.keys()) {
      const separator = key.lastIndexOf(":");
      const listId = key.slice(0, separator);
      const memberSubjectId = Number(key.slice(separator + 1));
      const list = this.lists.get(listId);
      if (memberSubjectId === subjectId && list?.userId === userId) {
        this.members.delete(key);
        this.lists.set(listId, { ...list, updatedAt });
      }
    }
  }

  async getProgress(userId: string, subjectId: number): Promise<StoredProgressRecord | null> {
    return this.progress.get(this.key(userId, subjectId)) ?? null;
  }

  async listProgress(
    userId: string,
    limit: number,
    offset: number,
    filters: ProgressRecordFilters = {},
  ): Promise<StoredProgressPage> {
    const data: StoredProgressItem[] = [...this.progress.values()]
      .filter((item) => item.userId === userId)
      .flatMap((p) => {
        const snapshot = this.snapshots.get(p.subjectId);
        if (!snapshot) return [];
        const collectedAt = this.records.get(this.key(userId, p.subjectId)) ?? null;
        return [
          {
            ...snapshot,
            stage: p.stage,
            completedChapters: p.completedChapters,
            progressCreatedAt: p.createdAt,
            progressUpdatedAt: p.updatedAt,
            collectedAt,
          },
        ];
      })
      .filter((item) => !filters.excludeNsfw || !item.nsfw)
      .filter((item) => !filters.type || item.type === filters.type)
      .filter((item) => !filters.stage || item.stage === filters.stage)
      .filter(
        (item) =>
          !filters.keyword ||
          item.title.toLocaleLowerCase().includes(filters.keyword.toLocaleLowerCase()),
      )
      .sort(
        (left, right) =>
          right.progressCreatedAt.getTime() - left.progressCreatedAt.getTime() ||
          right.subjectId - left.subjectId,
      );
    return { data: data.slice(offset, offset + limit), total: data.length };
  }

  async setProgress(
    userId: string,
    snapshot: SubjectSnapshotRecord,
    stage: ProgressStage,
    completedChapters: number | null,
    updatedAt: Date,
  ): Promise<StoredProgressRecord> {
    this.snapshots.set(snapshot.subjectId, snapshot);
    const key = this.key(userId, snapshot.subjectId);
    const existing = this.progress.get(key);
    if (existing && existing.stage === stage && existing.completedChapters === completedChapters) {
      return existing;
    }
    const record: StoredProgressRecord = {
      id: existing?.id ?? uuidv7(),
      userId,
      subjectId: snapshot.subjectId,
      stage,
      completedChapters,
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
    };
    this.progress.set(key, record);
    return record;
  }

  async clearProgress(userId: string, subjectId: number) {
    this.progress.delete(this.key(userId, subjectId));
  }

  async getCollectionListIds(userId: string, subjectId: number) {
    return [...this.members.keys()].flatMap((key) => {
      const separator = key.lastIndexOf(":");
      const listId = key.slice(0, separator);
      const memberSubjectId = Number(key.slice(separator + 1));
      return memberSubjectId === subjectId && this.lists.get(listId)?.userId === userId
        ? [listId]
        : [];
    });
  }

  async setCollection(
    userId: string,
    snapshot: SubjectSnapshotRecord,
    listIds: string[],
    collectedAt: Date,
  ) {
    if (listIds.some((id) => this.lists.get(id)?.userId !== userId)) return false;
    const currentListIds = new Set(await this.getCollectionListIds(userId, snapshot.subjectId));
    this.snapshots.set(snapshot.subjectId, snapshot);
    const recordKey = this.key(userId, snapshot.subjectId);
    if (!this.records.has(recordKey)) this.records.set(recordKey, collectedAt);
    for (const key of this.members.keys()) {
      const separator = key.lastIndexOf(":");
      const listId = key.slice(0, separator);
      const memberSubjectId = Number(key.slice(separator + 1));
      if (
        memberSubjectId === snapshot.subjectId &&
        this.lists.get(listId)?.userId === userId &&
        !listIds.includes(listId)
      ) {
        this.members.delete(key);
      }
    }
    for (const listId of listIds) {
      const memberKey = `${listId}:${snapshot.subjectId}`;
      if (!this.members.has(memberKey)) this.members.set(memberKey, collectedAt);
    }
    const nextListIds = new Set(listIds);
    for (const listId of new Set([...currentListIds, ...nextListIds])) {
      if (currentListIds.has(listId) === nextListIds.has(listId)) continue;
      const list = this.lists.get(listId);
      if (list) this.lists.set(listId, { ...list, updatedAt: collectedAt });
    }
    return true;
  }

  async listCollectionLists(userId: string, filters: ContentVisibilityFilters = {}) {
    return [...this.lists.values()]
      .filter((list) => list.userId === userId)
      .map((list) => ({
        ...list,
        count: [...this.members.keys()].filter((key) => {
          if (!key.startsWith(`${list.id}:`)) return false;
          if (!filters.excludeNsfw) return true;
          const subjectId = Number(key.slice(key.lastIndexOf(":") + 1));
          return !this.snapshots.get(subjectId)?.nsfw;
        }).length,
      }))
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
      );
  }

  async getPersonalRecordCounts(userId: string, filters: ContentVisibilityFilters = {}) {
    const visibleRecordKeys = [...this.records.keys()].filter((key) => {
      if (!key.startsWith(`${userId}:`)) return false;
      if (!filters.excludeNsfw) return true;
      const subjectId = Number(key.slice(userId.length + 1));
      return !this.snapshots.get(subjectId)?.nsfw;
    });
    const collections = visibleRecordKeys.length;
    const unlisted = visibleRecordKeys.filter((key) => {
      const subjectId = Number(key.slice(userId.length + 1));
      return ![...this.members.keys()].some((memberKey) => {
        const separator = memberKey.lastIndexOf(":");
        return Number(memberKey.slice(separator + 1)) === subjectId;
      });
    }).length;
    const progressStages = { in_progress: 0, completed: 0 };
    for (const [key, value] of this.progress) {
      if (
        key.startsWith(`${userId}:`) &&
        (!filters.excludeNsfw || !this.snapshots.get(value.subjectId)?.nsfw)
      ) {
        progressStages[value.stage]++;
      }
    }
    return {
      collections: { all: collections, unlisted },
      progress: {
        all: progressStages.in_progress + progressStages.completed,
        in_progress: progressStages.in_progress,
        completed: progressStages.completed,
      },
    };
  }

  async createCollectionList(
    userId: string,
    input: { id: string; name: string; shareToken: string; now: Date },
  ) {
    if (
      [...this.lists.values()].some((list) => list.userId === userId && list.name === input.name)
    ) {
      return null;
    }
    const list = {
      id: input.id,
      userId,
      name: input.name,
      isPublic: false,
      shareToken: input.shareToken,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.lists.set(list.id, list);
    return list;
  }

  async renameCollectionList(userId: string, listId: string, name: string, updatedAt: Date) {
    const list = this.lists.get(listId);
    if (!list || list.userId !== userId) return "not_found" as const;
    if (
      [...this.lists.values()].some(
        (other) => other.userId === userId && other.id !== listId && other.name === name,
      )
    ) {
      return "duplicate" as const;
    }
    this.lists.set(listId, { ...list, name, updatedAt });
    return "updated" as const;
  }

  async setCollectionListVisibility(
    userId: string,
    listId: string,
    isPublic: boolean,
    updatedAt: Date,
  ) {
    const list = this.lists.get(listId);
    if (!list || list.userId !== userId) return null;
    const updated = { ...list, isPublic, updatedAt };
    this.lists.set(listId, updated);
    return updated;
  }

  async getPublicCollectionList(
    shareToken: string,
    limit: number,
    offset: number,
    filters: ContentVisibilityFilters = {},
  ): Promise<StoredPublicCollectionListPage | null> {
    const list = [...this.lists.values()].find(
      (candidate) => candidate.shareToken === shareToken && candidate.isPublic,
    );
    if (!list) return null;
    const data = [...this.members]
      .flatMap(([key, addedAt]) => {
        const separator = key.lastIndexOf(":");
        const listId = key.slice(0, separator);
        const subjectId = Number(key.slice(separator + 1));
        const snapshot = this.snapshots.get(subjectId);
        return listId === list.id && snapshot
          ? [
              {
                ...snapshot,
                addedAt,
              },
            ]
          : [];
      })
      .filter((item) => !filters.excludeNsfw || !item.nsfw)
      .sort(
        (left, right) =>
          right.addedAt.getTime() - left.addedAt.getTime() || right.subjectId - left.subjectId,
      );
    return {
      list,
      ownerName: "Alice",
      data: data.slice(offset, offset + limit),
      total: data.length,
    };
  }

  async refreshSnapshot(snapshot: SubjectSnapshotRecord) {
    const existing = this.snapshots.get(snapshot.subjectId);
    if (!existing) return false;
    this.snapshots.set(snapshot.subjectId, snapshot);

    const oldTotal = existing.totalChapters ?? null;
    const newTotal = snapshot.totalChapters ?? null;

    if (
      (snapshot.type === "动画" || snapshot.type === "三次元") &&
      newTotal !== null &&
      newTotal > 0
    ) {
      for (const [key, p] of this.progress) {
        if (p.subjectId === snapshot.subjectId) {
          if (oldTotal === null || oldTotal === 0) {
            if (
              p.stage === "completed" &&
              (p.completedChapters === null || p.completedChapters < newTotal)
            ) {
              this.progress.set(key, { ...p, completedChapters: newTotal });
            } else if (
              p.stage === "in_progress" &&
              p.completedChapters !== null &&
              p.completedChapters >= newTotal
            ) {
              this.progress.set(key, { ...p, stage: "completed" });
            }
          } else if (newTotal > oldTotal) {
            if (
              p.stage === "completed" &&
              p.completedChapters !== null &&
              p.completedChapters < newTotal
            ) {
              this.progress.set(key, { ...p, stage: "in_progress" });
            }
          } else if (newTotal < oldTotal) {
            if (
              p.stage === "in_progress" &&
              p.completedChapters !== null &&
              p.completedChapters >= newTotal
            ) {
              this.progress.set(key, { ...p, stage: "completed" });
            }
          }
        }
      }
    }
    return true;
  }

  async deleteCollectionList(userId: string, listId: string) {
    const list = this.lists.get(listId);
    if (!list || list.userId !== userId) return false;
    this.lists.delete(listId);
    for (const key of this.members.keys()) {
      if (key.startsWith(`${listId}:`)) this.members.delete(key);
    }
    return true;
  }

  async removeCollectionListMember(
    userId: string,
    listId: string,
    subjectId: number,
    updatedAt: Date,
  ) {
    const list = this.lists.get(listId);
    if (list?.userId !== userId) return false;
    if (this.members.delete(`${listId}:${subjectId}`)) {
      this.lists.set(listId, { ...list, updatedAt });
    }
    return true;
  }
}

let currentTime = new Date("2026-03-31T00:00:00.000Z");
const repository = new MemoryCollections();
const auth: AuthBoundary = {
  isAvailable: () => true,
  handler: async (request) => Response.json(await request.json()),
  getSession: async (request) => {
    const bearerUser = request.headers.get("Authorization") === "Bearer mini-token" ? "mini" : null;
    const user = bearerUser ?? request.headers.get("X-Test-User");
    return user
      ? {
          user: {
            id: user,
            name: user === "alice" ? "Alice" : user === "mini" ? "Mini" : "Bob",
            email: `${user}@example.test`,
          },
        }
      : null;
  },
};
const scheduledTasks: Promise<unknown>[] = [];
const executionContext = {
  waitUntil: (task: Promise<unknown>) => scheduledTasks.push(task),
  passThroughOnException: () => undefined,
  props: {},
};
const upstreamFetch = vi.fn(async (input: string | URL | Request) => {
  const id = Number(
    new URL(input instanceof Request ? input.url : input).pathname.split("/").at(-1),
  );
  const subjects: Record<
    number,
    { name: string; name_cn: string; type: number; total_chapters?: number }
  > = {
    41: { name: "Alpha book", name_cn: "阿尔法书", type: 1 },
    42: { name: "Trusted title", name_cn: "可信标题", type: 2, total_chapters: 12 },
    43: { name: "Beta anime", name_cn: "贝塔动画", type: 2, total_chapters: 24 },
    44: { name: "Gamma music", name_cn: "伽马音乐", type: 3 },
    45: { name: "Delta game", name_cn: "德尔塔游戏", type: 4 },
  };
  const subject = subjects[id] ?? subjects[42]!;
  return Response.json({
    id,
    ...subject,
    nsfw: false,
    images: { common: `http://lain.bgm.tv/pic/cover/c/${id}.jpg` },
  });
});
const app = createApp({
  auth,
  collections: () => repository,
  fetch: upstreamFetch,
  now: () => currentTime,
  updateSubjectSnapshot: (_bindings, snapshot) => repository.refreshSnapshot(snapshot),
});

function privateRequest(method = "GET", user = "alice", body?: unknown) {
  return {
    method,
    headers: {
      Origin: bindings.WEB_ORIGIN,
      "X-Test-User": user,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

beforeEach(() => {
  repository.snapshots.clear();
  repository.records.clear();
  repository.progress.clear();
  repository.lists.clear();
  repository.members.clear();
  currentTime = new Date("2026-03-31T00:00:00.000Z");
  upstreamFetch.mockClear();
  scheduledTasks.length = 0;
});

describe("private collection HTTP contract", () => {
  test("requires a session and an exact write origin", async () => {
    const anonymous = await app.request("/me/collections", {}, bindings);
    const badOrigin = await app.request(
      "/me/collections/42",
      {
        method: "PUT",
        headers: { Origin: "https://evil.example", "X-Test-User": "alice" },
      },
      bindings,
    );

    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "请先登录。",
      retryable: false,
    });
    expect(badOrigin.status).toBe(403);
    expect(await badOrigin.json()).toEqual({
      code: "INVALID_ORIGIN",
      message: "请求来源无效。",
      retryable: false,
    });
  });

  test("allows a valid bearer-authenticated write without a Web origin", async () => {
    const response = await app.request(
      "/me/collections/42",
      {
        method: "PUT",
        headers: { Authorization: "Bearer mini-token" },
      },
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ collected: true, listIds: [] });
  });

  test("does not let an invalid bearer header bypass the Web origin check", async () => {
    const response = await app.request(
      "/me/collections/42",
      {
        method: "PUT",
        headers: { Authorization: "Bearer invalid-token" },
      },
      bindings,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
  });

  test("creates a trusted snapshot and ignores forged client metadata", async () => {
    const putResponse = await app.request(
      "/me/collections/42",
      privateRequest("PUT", "alice", {
        title: "伪造标题",
        type: "书籍",
        nsfw: true,
      }),
      bindings,
    );
    const pageResponse = await app.request("/me/collections", privateRequest(), bindings);
    const stateResponse = await app.request("/me/subjects/42", privateRequest(), bindings);

    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({ collected: true, listIds: [] });
    expect(await pageResponse.json()).toEqual({
      page: 1,
      pageSize: 24,
      data: [
        {
          id: 42,
          title: "可信标题",
          type: "动画",
          imageUrl:
            "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fc%2F42.jpg&size=large",
          nsfw: false,
          collectedAt: currentTime.toISOString(),
          progress: null,
        },
      ],
      hasPrevious: false,
      hasNext: false,
      total: 1,
    });
    expect(await stateResponse.json()).toEqual({ collected: true, listIds: [], progress: null });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  test("filters Mini-restricted subjects before paging and counting without changing Web defaults", async () => {
    const visible = {
      subjectId: 42,
      title: "可见动画",
      type: "动画" as const,
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: 12,
      updatedAt: currentTime,
    };
    const restricted = {
      ...visible,
      subjectId: 99,
      title: "受限动画",
      nsfw: true,
    };
    repository.snapshots.set(visible.subjectId, visible);
    repository.snapshots.set(restricted.subjectId, restricted);
    repository.records.set(repository.key("alice", visible.subjectId), currentTime);
    repository.records.set(repository.key("alice", restricted.subjectId), currentTime);
    for (const snapshot of [visible, restricted]) {
      repository.progress.set(repository.key("alice", snapshot.subjectId), {
        id: uuidv7(),
        userId: "alice",
        subjectId: snapshot.subjectId,
        stage: "in_progress",
        completedChapters: 1,
        createdAt: currentTime,
        updatedAt: currentTime,
      });
    }
    const listId = uuidv7();
    const shareToken = crypto.randomUUID();
    repository.lists.set(listId, {
      id: listId,
      userId: "alice",
      name: "混合列表",
      isPublic: true,
      shareToken,
      createdAt: currentTime,
      updatedAt: currentTime,
    });
    repository.members.set(`${listId}:${visible.subjectId}`, currentTime);
    repository.members.set(`${listId}:${restricted.subjectId}`, currentTime);

    const [webCollections, miniCollections, miniProgress, miniLists, miniCounts, publicList] =
      await Promise.all([
        app.request("/me/collections", privateRequest(), bindings),
        app.request("/me/collections?excludeNsfw=true", privateRequest(), bindings),
        app.request("/me/progress?excludeNsfw=true", privateRequest(), bindings),
        app.request("/me/collection-lists?excludeNsfw=true", privateRequest(), bindings),
        app.request("/me/personal-record-counts?excludeNsfw=true", privateRequest(), bindings),
        app.request(`/public/collection-lists/${shareToken}?excludeNsfw=true`, {}, bindings),
      ]);

    expect((await webCollections.json()).total).toBe(2);
    expect(await miniCollections.json()).toMatchObject({
      total: 1,
      data: [{ id: visible.subjectId, nsfw: false }],
    });
    expect(await miniProgress.json()).toMatchObject({
      total: 1,
      data: [{ id: visible.subjectId, nsfw: false }],
    });
    expect(await miniLists.json()).toMatchObject({ data: [{ id: listId, count: 1 }] });
    expect(await miniCounts.json()).toEqual({
      collections: { all: 1, unlisted: 0 },
      progress: { all: 1, in_progress: 1, completed: 0 },
    });
    expect(await publicList.json()).toMatchObject({
      total: 1,
      data: [{ id: visible.subjectId, nsfw: false }],
    });
  });

  test("rejects invalid Mini content visibility parameters", async () => {
    const response = await app.request(
      "/me/collections?excludeNsfw=false",
      privateRequest(),
      bindings,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_COLLECTION_QUERY" });
  });

  test("is idempotent, isolates users, and removes only the owner's record", async () => {
    await app.request("/me/collections/42", privateRequest("PUT", "alice"), bindings);
    await app.request("/me/collections/42", privateRequest("PUT", "alice"), bindings);
    await app.request("/me/collections/42", privateRequest("PUT", "bob"), bindings);

    const counts = await app.request("/me/personal-record-counts", privateRequest(), bindings);
    expect(await counts.json()).toEqual({
      collections: { all: 1, unlisted: 1 },
      progress: { all: 0, in_progress: 0, completed: 0 },
    });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const deleteResponse = await app.request(
      "/me/collections/42",
      privateRequest("DELETE", "alice"),
      bindings,
    );
    const alicePage = await app.request(
      "/me/collections",
      privateRequest("GET", "alice"),
      bindings,
    );
    const bobPage = await app.request("/me/collections", privateRequest("GET", "bob"), bindings);

    expect(deleteResponse.status).toBe(200);
    expect((await bobPage.json()).data).toHaveLength(1);
    expect((await alicePage.json()).data).toEqual([]);
    expect(repository.snapshots.has(42)).toBe(true);
  });

  test("does not create partial data when the first trusted snapshot fails", async () => {
    // The shared upstream client retries a transient failure once.
    upstreamFetch
      .mockImplementationOnce(async () => new Response(null, { status: 503 }))
      .mockImplementationOnce(async () => new Response(null, { status: 503 }));

    const response = await app.request("/me/collections/42", privateRequest("PUT"), bindings);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      code: "COLLECTION_SNAPSHOT_UNAVAILABLE",
      message: "条目资料暂时无法验证，请稍后重试。",
      retryable: true,
    });
    expect(repository.records.size).toBe(0);
    expect(repository.snapshots.size).toBe(0);
  });
});

describe("private collection-list HTTP contract", () => {
  test("generates UUIDv7 id and UUIDv4 shareId and normalizes names", async () => {
    const created = await app.request(
      "/me/collection-lists",
      privateRequest("POST", "alice", { name: "  周末补番  " }),
      bindings,
    );
    const list = await created.json();

    expect(created.status).toBe(201);
    expect(list.name).toBe("周末补番");
    expect(list.isPublic).toBe(false);
    expect(list.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(list.shareId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test("keeps concurrent duplicate submissions idempotent", async () => {
    const [firstList, duplicateList] = await Promise.all([
      app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "并发列表" }),
        bindings,
      ),
      app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "并发列表" }),
        bindings,
      ),
    ]);
    const list = await (firstList.status === 201 ? firstList : duplicateList).json();
    const duplicateStatus = firstList.status === 409 ? firstList.status : duplicateList.status;
    const writes = await Promise.all([
      app.request(
        "/me/collections/42",
        privateRequest("PUT", "alice", { listIds: [list.id] }),
        bindings,
      ),
      app.request(
        "/me/collections/42",
        privateRequest("PUT", "alice", { listIds: [list.id] }),
        bindings,
      ),
    ]);
    const state = await (await app.request("/me/subjects/42", privateRequest(), bindings)).json();

    expect([firstList.status, duplicateList.status].sort()).toEqual([201, 409]);
    expect(duplicateStatus).toBe(409);
    expect(writes.map((response) => response.status)).toEqual([200, 200]);
    expect(state.listIds).toEqual([list.id]);
  });

  test("validates the one-to-fifty-character normalized list name", async () => {
    for (const name of ["", "   ", "x".repeat(51)]) {
      const response = await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name }),
        bindings,
      );
      expect(response.status).toBe(400);
    }
    expect(
      (
        await app.request(
          "/me/collection-lists",
          privateRequest("POST", "alice", { name: "有效名称" }),
          bindings,
        )
      ).status,
    ).toBe(201);
  });

  test("accepts the Mini-compatible PUT method when renaming a list", async () => {
    const created = await (
      await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "旧名称" }),
        bindings,
      )
    ).json();

    const renamed = await app.request(
      `/me/collection-lists/${created.id}`,
      privateRequest("PUT", "alice", { name: "新名称" }),
      bindings,
    );
    const lists = await app.request("/me/collection-lists", privateRequest(), bindings);

    expect(renamed.status).toBe(200);
    expect(await lists.json()).toMatchObject({ data: [{ id: created.id, name: "新名称" }] });
  });

  test("atomically synchronizes multiple memberships and preserves records when deleting a list", async () => {
    const firstList = await (
      await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "列表一" }),
        bindings,
      )
    ).json();
    const secondList = await (
      await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "列表二" }),
        bindings,
      )
    ).json();

    await app.request(
      "/me/collections/42",
      privateRequest("PUT", "alice", { listIds: [firstList.id, secondList.id] }),
      bindings,
    );
    const beforeState = await (
      await app.request("/me/subjects/42", privateRequest(), bindings)
    ).json();
    expect(beforeState.listIds).toEqual([firstList.id, secondList.id].sort());

    await app.request(
      `/me/collection-lists/${firstList.id}/subjects/42`,
      privateRequest("DELETE", "alice"),
      bindings,
    );
    const memberRemoved = await (
      await app.request("/me/subjects/42", privateRequest(), bindings)
    ).json();
    expect(memberRemoved.listIds).toEqual([secondList.id]);

    await app.request(
      `/me/collection-lists/${secondList.id}`,
      privateRequest("DELETE", "alice"),
      bindings,
    );
    const afterDelete = await (
      await app.request("/me/subjects/42", privateRequest(), bindings)
    ).json();
    expect(afterDelete).toEqual({ collected: true, listIds: [], progress: null });
  });
});

describe("public collection-list HTTP contract", () => {
  test("publishes a stable anonymous read model with ownerName and without private fields or status", async () => {
    const list = await (
      await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "公开清单" }),
        bindings,
      )
    ).json();
    await app.request(
      "/me/collections/42",
      privateRequest("PUT", "alice", { listIds: [list.id] }),
      bindings,
    );
    await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { stage: "completed" }),
      bindings,
    );

    const privateResponse = await app.request(
      `/public/collection-lists/${list.shareId}`,
      {},
      bindings,
    );
    const published = await app.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "alice", { isPublic: true }),
      bindings,
    );
    const publicResponse = await app.request(
      `/public/collection-lists/${list.shareId}?page=1&pageSize=24`,
      { headers: { Origin: bindings.WEB_ORIGIN } },
      bindings,
    );
    const authenticatedVisitor = await app.request(
      `/public/collection-lists/${list.shareId}?page=1&pageSize=24`,
      privateRequest("GET", "bob"),
      bindings,
    );
    const body = await publicResponse.json();

    expect(privateResponse.status).toBe(404);
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ isPublic: true, shareId: list.shareId });
    expect(publicResponse.status).toBe(200);
    expect(await authenticatedVisitor.json()).toEqual(body);
    expect(publicResponse.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(publicResponse.headers.get("Access-Control-Allow-Origin")).toBe(bindings.WEB_ORIGIN);
    expect(body).toEqual({
      name: "公开清单",
      ownerName: "Alice",
      updatedAt: currentTime.toISOString(),
      page: 1,
      pageSize: 24,
      data: [
        {
          id: 42,
          title: "可信标题",
          type: "动画",
          imageUrl:
            "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fc%2F42.jpg&size=large",
          nsfw: false,
        },
      ],
      hasPrevious: false,
      hasNext: false,
      total: 1,
    });
    // Privacy: ownerName is present ("Alice"), but user email, user id, and session must NEVER leak
    expect(body.ownerName).toBe("Alice");
    expect(JSON.stringify(body)).not.toMatch(/email|userId|shareToken|session/i);
  });

  test("rejects foreign visibility changes and makes revocation immediate", async () => {
    const list = await (
      await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "可撤回" }),
        bindings,
      )
    ).json();
    const foreign = await app.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "bob", { isPublic: true }),
      bindings,
    );
    await app.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "alice", { isPublic: true }),
      bindings,
    );
    const visible = await app.request(`/public/collection-lists/${list.shareId}`, {}, bindings);
    await app.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "alice", { isPublic: false }),
      bindings,
    );
    const revoked = await app.request(`/public/collection-lists/${list.shareId}`, {}, bindings);
    const unknown = await app.request("/public/collection-lists/unknown", {}, bindings);
    const republished = await app.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "alice", { isPublic: true }),
      bindings,
    );

    expect(foreign.status).toBe(404);
    expect(visible.status).toBe(200);
    expect(revoked.status).toBe(404);
    expect(await revoked.json()).toEqual(await unknown.json());
    expect(await republished.json()).toMatchObject({ isPublic: true, shareId: list.shareId });
  });

  test("updates directory at the three-item threshold and withdraws immediately", async () => {
    const localRepository = new MemoryCollections();
    const directory = createMemoryDirectoryRepository();
    const localApp = createApp({
      auth,
      collections: () => localRepository,
      directory: () => directory,
      fetch: upstreamFetch,
      now: () => currentTime,
    });
    const list = await (
      await localApp.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "三项精选" }),
        bindings,
      )
    ).json();
    for (const subjectId of [41, 42, 43]) {
      await localApp.request(
        `/me/collections/${subjectId}`,
        privateRequest("PUT", "alice", { listIds: [list.id] }),
        bindings,
      );
    }
    await localApp.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "alice", { isPublic: true }),
      bindings,
    );

    const publicResponse = await localApp.request(
      `/public/collection-lists/${list.shareId}`,
      {},
      bindings,
    );
    expect((await publicResponse.json()).updatedAt).toBe(currentTime.toISOString());
    expect(
      await directory.listEntries({
        resourceType: "collection_list",
        indexStatus: "index",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([
      expect.objectContaining({
        externalId: list.shareId,
        indexReason: "public_collection_list",
      }),
    ]);

    currentTime = new Date(currentTime.getTime() + 1_000);
    await localApp.request(
      `/me/collection-lists/${list.id}/subjects/43`,
      privateRequest("DELETE", "alice"),
      bindings,
    );
    const thinned = await localApp.request(
      `/public/collection-lists/${list.shareId}`,
      {},
      bindings,
    );
    expect((await thinned.json()).updatedAt).toBe(currentTime.toISOString());
    expect(
      await directory.listEntries({
        resourceType: "collection_list",
        indexStatus: "noindex",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ indexReason: "insufficient_items" })]);

    await localApp.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "alice", { isPublic: false }),
      bindings,
    );
    expect(
      (await localApp.request(`/public/collection-lists/${list.shareId}`, {}, bindings)).status,
    ).toBe(404);
  });

  test("public collection list exposes ownerName and no public write contract", async () => {
    const list = await (
      await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "状态清单" }),
        bindings,
      )
    ).json();
    await app.request(
      "/me/collections/42",
      privateRequest("PUT", "alice", { listIds: [list.id] }),
      bindings,
    );
    await app.request(
      `/me/collection-lists/${list.id}/visibility`,
      privateRequest("PUT", "alice", { isPublic: true }),
      bindings,
    );

    const read = await app.request(`/public/collection-lists/${list.shareId}`, {}, bindings);
    const write = await app.request(
      `/public/collection-lists/${list.shareId}`,
      { method: "PUT", body: "{}" },
      bindings,
    );

    expect((await read.json()).ownerName).toBe("Alice");
    expect(write.status).toBe(404);
  });
});

describe("subject snapshot freshness HTTP contract", () => {
  test("returns old personal data first and refreshes only after twenty-four hours", async () => {
    const snapshot = {
      subjectId: 42,
      title: "旧标题",
      type: "动画" as const,
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: new Date(currentTime.getTime() - 24 * 60 * 60 * 1000),
    };
    repository.snapshots.set(42, snapshot);
    repository.records.set(repository.key("alice", 42), currentTime);

    const freshEnough = await app.request("/me/collections", privateRequest(), bindings);
    expect((await freshEnough.json()).data[0].title).toBe("旧标题");
    expect(scheduledTasks).toHaveLength(0);

    currentTime = new Date(currentTime.getTime() + 1);
    const stale = await app.request(
      "/me/collections",
      privateRequest(),
      bindings,
      executionContext,
    );
    expect((await stale.json()).data[0].title).toBe("旧标题");
    expect(scheduledTasks).toHaveLength(1);

    await Promise.all(scheduledTasks.splice(0));
    expect(repository.snapshots.get(42)).toMatchObject({
      title: "可信标题",
      updatedAt: currentTime,
    });

    repository.records.set(repository.key("bob", 42), currentTime);
    const bob = await app.request("/me/collections", privateRequest("GET", "bob"), bindings);
    expect((await bob.json()).data[0].title).toBe("可信标题");
    expect(repository.snapshots.size).toBe(1);
    expect(scheduledTasks).toHaveLength(0);
  });

  test("refreshes at most the four oldest stale snapshots per request", async () => {
    for (let index = 0; index < 6; index += 1) {
      const subjectId = 101 + index;
      repository.snapshots.set(subjectId, {
        subjectId,
        title: `旧标题 ${subjectId}`,
        type: "动画",
        posterSourceUrl: null,
        nsfw: false,
        totalChapters: null,
        updatedAt: new Date(currentTime.getTime() - (30 + index) * 60 * 60 * 1000),
      });
      repository.records.set(repository.key("alice", subjectId), currentTime);
    }
    upstreamFetch.mockClear();

    await app.request("/me/collections", privateRequest(), bindings, executionContext);
    await Promise.all(scheduledTasks.splice(0));

    const refreshed = upstreamFetch.mock.calls
      .map(([input]) => String(input instanceof Request ? input.url : input))
      .map((url) => Number(new URL(url).pathname.split("/").at(-1)))
      .toSorted();
    expect(refreshed).toEqual([103, 104, 105, 106]);
  });

  test("refreshes stale snapshots returned by the progress page", async () => {
    const oldUpdatedAt = new Date(currentTime.getTime() - 25 * 60 * 60 * 1000);
    repository.snapshots.set(42, {
      subjectId: 42,
      title: "旧状态标题",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: 12,
      updatedAt: oldUpdatedAt,
    });
    repository.progress.set(repository.key("alice", 42), {
      id: uuidv7(),
      userId: "alice",
      subjectId: 42,
      stage: "in_progress",
      completedChapters: 5,
      createdAt: currentTime,
      updatedAt: currentTime,
    });

    const response = await app.request(
      "/me/progress",
      privateRequest(),
      bindings,
      executionContext,
    );
    expect((await response.json()).data[0].title).toBe("旧状态标题");
    expect(scheduledTasks).toHaveLength(1);
    await Promise.all(scheduledTasks.splice(0));
    expect(repository.snapshots.get(42)?.title).toBe("可信标题");
  });

  test("keeps stale shared data and personal records when a bounded refresh fails", async () => {
    const oldUpdatedAt = new Date(currentTime.getTime() - 25 * 60 * 60 * 1000);
    repository.snapshots.set(42, {
      subjectId: 42,
      title: "仍可识别",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: oldUpdatedAt,
    });
    repository.records.set(repository.key("alice", 42), currentTime);
    repository.records.set(repository.key("bob", 42), currentTime);
    upstreamFetch
      .mockImplementationOnce(async () => new Response(null, { status: 503 }))
      .mockImplementationOnce(async () => new Response(null, { status: 503 }));

    const response = await app.request(
      "/me/collections",
      privateRequest(),
      bindings,
      executionContext,
    );
    expect((await response.json()).data[0].title).toBe("仍可识别");
    expect(scheduledTasks).toHaveLength(1);
    await Promise.all(scheduledTasks.splice(0));

    expect(repository.snapshots.get(42)?.updatedAt).toEqual(oldUpdatedAt);
    expect(repository.records.size).toBe(2);
    expect(repository.snapshots.size).toBe(1);
  });

  test("detail upstream failures never delete an existing snapshot or personal record", async () => {
    const snapshot = {
      subjectId: 42,
      title: "保留标题",
      type: "动画" as const,
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: new Date(currentTime.getTime() - 48 * 60 * 60 * 1000),
    };
    repository.snapshots.set(42, snapshot);
    repository.records.set(repository.key("alice", 42), currentTime);
    upstreamFetch.mockImplementationOnce(async () => new Response(null, { status: 404 }));

    const response = await app.request("/subjects/42", {}, bindings);

    expect(response.status).toBe(404);
    expect(repository.snapshots.get(42)).toEqual(snapshot);
    expect(repository.records.has(repository.key("alice", 42))).toBe(true);
  });

  test("successful detail reads update only snapshots that already exist", async () => {
    const oldUpdatedAt = new Date(currentTime.getTime() - 48 * 60 * 60 * 1000);
    repository.snapshots.set(42, {
      subjectId: 42,
      title: "旧标题",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: oldUpdatedAt,
    });

    const existing = await app.request("/subjects/42", {}, bindings);
    const missing = await app.request("/subjects/43", {}, bindings);

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(repository.snapshots.get(42)).toMatchObject({
      title: "可信标题",
      updatedAt: currentTime,
    });
    expect(repository.snapshots.has(43)).toBe(false);
  });
});

describe("private personal-record query contract", () => {
  test("combines list, type, and trimmed title filters on collections", async () => {
    const list = await (
      await app.request(
        "/me/collection-lists",
        privateRequest("POST", "alice", { name: "动画" }),
        bindings,
      )
    ).json();
    await app.request("/me/collections/41", privateRequest("PUT"), bindings);
    for (const subjectId of [42, 43]) {
      await app.request(
        `/me/collections/${subjectId}`,
        privateRequest("PUT", "alice", { listIds: [list.id] }),
        bindings,
      );
    }

    const filteredCollections = await app.request(
      `/me/collections?list=${list.id}&type=anime&keyword=%20%E8%B4%9D%E5%A1%94%20&page=1&pageSize=24`,
      privateRequest(),
      bindings,
    );
    const unlisted = await app.request(
      "/me/collections?list=unlisted&page=1&pageSize=24",
      privateRequest(),
      bindings,
    );

    expect((await filteredCollections.json()).data.map((item: { id: number }) => item.id)).toEqual([
      43,
    ]);
    expect((await unlisted.json()).data.map((item: { id: number }) => item.id)).toEqual([41]);
  });

  test("combines type, stage, and trimmed keyword on progress", async () => {
    await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { stage: "completed" }),
      bindings,
    );
    await app.request(
      "/me/progress/43",
      privateRequest("PUT", "alice", { stage: "in_progress", completedChapters: 5 }),
      bindings,
    );

    const filtered = await app.request(
      `/me/progress?type=anime&stage=completed&keyword=%E5%8F%AF%E4%BF%A1&page=1&pageSize=24`,
      privateRequest(),
      bindings,
    );
    expect((await filtered.json()).data.map((item: { id: number }) => item.id)).toEqual([42]);
  });

  test("returns fixed twenty-four-item pages with stable subject ordering", async () => {
    for (let subjectId = 1; subjectId <= 25; subjectId += 1) {
      await app.request(`/me/collections/${subjectId}`, privateRequest("PUT"), bindings);
    }
    const first = await (
      await app.request("/me/collections?page=1&pageSize=24", privateRequest(), bindings)
    ).json();
    const second = await (
      await app.request("/me/collections?page=2&pageSize=24", privateRequest(), bindings)
    ).json();

    expect(first.data.map((item: { id: number }) => item.id)).toEqual(
      Array.from({ length: 24 }, (_, index) => 25 - index),
    );
    expect(first.hasNext).toBe(true);
    expect(second.data.map((item: { id: number }) => item.id)).toEqual([1]);
    expect(second.hasPrevious).toBe(true);
  });

  test("rejects malformed private query parameters", async () => {
    for (const path of [
      "/me/collections?type=movie",
      "/me/collections?keyword=%20%20",
      "/me/progress?stage=watching",
      "/me/progress?stage=invalid",
    ]) {
      const response = await app.request(path, privateRequest(), bindings);
      expect(response.status, path).toBe(400);
    }
  });
});

describe("private progress HTTP contract", () => {
  test("keeps progress ordering stable while editing an existing record", async () => {
    await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 1 }),
      bindings,
    );
    currentTime = new Date("2026-03-31T01:00:00.000Z");
    await app.request(
      "/me/progress/43",
      privateRequest("PUT", "alice", { completedChapters: 1 }),
      bindings,
    );
    currentTime = new Date("2026-03-31T02:00:00.000Z");
    await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 2 }),
      bindings,
    );

    const response = await app.request("/me/progress", privateRequest(), bindings);
    expect((await response.json()).data.map((item: { id: number }) => item.id)).toEqual([43, 42]);
  });

  test("supports chapter and stage for animation and rejects music entirely", async () => {
    // 动画 (42): supports chapter counts and stage
    const animeRes = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 3 }),
      bindings,
    );
    expect(animeRes.status).toBe(200);
    const animeBody = await animeRes.json();
    expect(animeBody.progress.stage).toBe("in_progress");
    expect(animeBody.progress.completedChapters).toBe(3);
    expect(animeBody.progress.totalChapters).toBe(12);

    // 音乐 (44): rejected with 400 INVALID_PROGRESS
    const musicRes = await app.request(
      "/me/progress/44",
      privateRequest("PUT", "alice", { stage: "in_progress" }),
      bindings,
    );
    expect(musicRes.status).toBe(400);
    expect((await musicRes.json()).code).toBe("INVALID_PROGRESS");

    repository.snapshots.set(98, {
      subjectId: 98,
      title: "其他条目",
      type: "其他",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: currentTime,
    });
    const otherRes = await app.request(
      "/me/progress/98",
      privateRequest("PUT", "alice", { stage: "in_progress" }),
      bindings,
    );
    expect(otherRes.status).toBe(400);
    expect((await otherRes.json()).code).toBe("INVALID_PROGRESS");

    const nullChapters = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: null }),
      bindings,
    );
    expect(nullChapters.status).toBe(400);
    expect((await nullChapters.json()).code).toBe("INVALID_PROGRESS");
  });

  test("books and games support stage only and reject chapter counts", async () => {
    // 书籍 (41): accepts stage
    const bookRes = await app.request(
      "/me/progress/41",
      privateRequest("PUT", "alice", { stage: "in_progress" }),
      bindings,
    );
    expect(bookRes.status).toBe(200);
    expect((await bookRes.json()).progress.completedChapters).toBeNull();

    await repository.refreshSnapshot({
      subjectId: 41,
      title: "阿尔法书",
      type: "书籍",
      posterSourceUrl: "http://lain.bgm.tv/pic/cover/c/41.jpg",
      nsfw: false,
      totalChapters: 10,
      updatedAt: currentTime,
    });
    expect(repository.progress.get(repository.key("alice", 41))).toMatchObject({
      stage: "in_progress",
      completedChapters: null,
    });

    // 书籍 (41): rejects chapter counts
    const bookWithChapters = await app.request(
      "/me/progress/41",
      privateRequest("PUT", "alice", { stage: "in_progress", completedChapters: 5 }),
      bindings,
    );
    expect(bookWithChapters.status).toBe(400);
    expect((await bookWithChapters.json()).code).toBe("INVALID_PROGRESS");

    const bookWithNullChapters = await app.request(
      "/me/progress/41",
      privateRequest("PUT", "alice", { stage: "in_progress", completedChapters: null }),
      bindings,
    );
    expect(bookWithNullChapters.status).toBe(400);

    // 游戏 (45): accepts stage
    const gameRes = await app.request(
      "/me/progress/45",
      privateRequest("PUT", "alice", { stage: "completed" }),
      bindings,
    );
    expect(gameRes.status).toBe(200);
    expect((await gameRes.json()).progress.stage).toBe("completed");

    // 游戏 (45): rejects chapter counts
    const gameWithChapters = await app.request(
      "/me/progress/45",
      privateRequest("PUT", "alice", { stage: "completed", completedChapters: 1 }),
      bindings,
    );
    expect(gameWithChapters.status).toBe(400);
    expect((await gameWithChapters.json()).code).toBe("INVALID_PROGRESS");
  });

  test("enforces known-total synchronization and permits counts exceeding total", async () => {
    // Subject 42 has total_chapters: 12
    // 1. Count reaching total => automatically completed
    const reachRes = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 12 }),
      bindings,
    );
    expect(reachRes.status).toBe(200);
    expect((await reachRes.json()).progress).toMatchObject({
      stage: "completed",
      completedChapters: 12,
    });

    // 2. Count exceeding total (e.g. 15 for specials/OVAs) => completed, count preserved
    const exceedRes = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 15 }),
      bindings,
    );
    expect(exceedRes.status).toBe(200);
    expect((await exceedRes.json()).progress).toMatchObject({
      stage: "completed",
      completedChapters: 15,
    });

    // 3. Decreasing below total => automatically in_progress
    const dropRes = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 11 }),
      bindings,
    );
    expect(dropRes.status).toBe(200);
    expect((await dropRes.json()).progress).toMatchObject({
      stage: "in_progress",
      completedChapters: 11,
    });

    // 4. Manual complete with known total fills count to total
    const manualCompleteRes = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { stage: "completed" }),
      bindings,
    );
    expect(manualCompleteRes.status).toBe(200);
    expect((await manualCompleteRes.json()).progress).toMatchObject({
      stage: "completed",
      completedChapters: 12,
    });

    // 5. A completed known-total record must be decreased before returning to in_progress
    const switchOngoingRes = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { stage: "in_progress" }),
      bindings,
    );
    expect(switchOngoingRes.status).toBe(400);
    expect((await switchOngoingRes.json()).code).toBe("INVALID_PROGRESS");
  });

  test("permits manual completion when total is unknown", async () => {
    // Create snapshot with unknown total (null)
    repository.snapshots.set(99, {
      subjectId: 99,
      title: "未知总数动画",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: currentTime,
    });

    const completed = await app.request(
      "/me/progress/99",
      privateRequest("PUT", "alice", { stage: "completed", completedChapters: 5 }),
      bindings,
    );
    expect(completed.status).toBe(200);
    expect((await completed.json()).progress).toMatchObject({
      stage: "completed",
      completedChapters: 5,
      totalChapters: null,
    });

    const inProgress = await app.request(
      "/me/progress/99",
      privateRequest("PUT", "alice", { stage: "in_progress", completedChapters: 5 }),
      bindings,
    );
    expect(inProgress.status).toBe(200);
    expect((await inProgress.json()).progress).toMatchObject({
      stage: "in_progress",
      completedChapters: 5,
    });
  });

  test("reconciles total changes without bumping the user's updatedAt", async () => {
    const initialTime = new Date("2026-03-31T10:00:00.000Z");
    currentTime = initialTime;

    // 1. Unknown total (null) completed with count 5
    repository.snapshots.set(100, {
      subjectId: 100,
      title: "连载中动画",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: initialTime,
    });

    await app.request(
      "/me/progress/100",
      privateRequest("PUT", "alice", { stage: "completed", completedChapters: 5 }),
      bindings,
    );
    const initialProgress = repository.progress.get(repository.key("alice", 100));
    expect(initialProgress?.updatedAt).toEqual(initialTime);

    // Later, metadata reconciliation updates snapshot from null -> 12
    const reconcileTime = new Date("2026-03-31T12:00:00.000Z");
    currentTime = reconcileTime;
    await repository.refreshSnapshot({
      subjectId: 100,
      title: "连载中动画",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: 12,
      updatedAt: reconcileTime,
    });

    // Completed record below total (5 < 12) is filled to 12, and user updatedAt is preserved!
    const reconciled = repository.progress.get(repository.key("alice", 100));
    expect(reconciled?.completedChapters).toBe(12);
    expect(reconciled?.stage).toBe("completed");
    expect(reconciled?.updatedAt).toEqual(initialTime); // MUST NOT change!

    // Later, total grows from 12 -> 24 (e.g. split cour second season announced)
    const growthTime = new Date("2026-03-31T14:00:00.000Z");
    currentTime = growthTime;
    await repository.refreshSnapshot({
      subjectId: 100,
      title: "连载中动画",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: 24,
      updatedAt: growthTime,
    });

    // Stage becomes in_progress since completedChapters (12) < new total (24), updatedAt preserved!
    const grown = repository.progress.get(repository.key("alice", 100));
    expect(grown?.stage).toBe("in_progress");
    expect(grown?.completedChapters).toBe(12);
    expect(grown?.updatedAt).toEqual(initialTime); // MUST NOT change!

    await repository.refreshSnapshot({
      subjectId: 100,
      title: "连载中动画",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: 10,
      updatedAt: new Date("2026-03-31T15:00:00.000Z"),
    });
    const reduced = repository.progress.get(repository.key("alice", 100));
    expect(reduced?.stage).toBe("completed");
    expect(reduced?.completedChapters).toBe(12);
    expect(reduced?.updatedAt).toEqual(initialTime);

    const countTime = new Date("2026-03-31T16:00:00.000Z");
    currentTime = countTime;
    repository.snapshots.set(101, {
      subjectId: 101,
      title: "未知总数动画",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: null,
      updatedAt: countTime,
    });
    await app.request(
      "/me/progress/101",
      privateRequest("PUT", "alice", { completedChapters: 5 }),
      bindings,
    );
    await repository.refreshSnapshot({
      subjectId: 101,
      title: "未知总数动画",
      type: "动画",
      posterSourceUrl: null,
      nsfw: false,
      totalChapters: 5,
      updatedAt: new Date("2026-03-31T18:00:00.000Z"),
    });
    const newlyKnown = repository.progress.get(repository.key("alice", 101));
    expect(newlyKnown?.stage).toBe("completed");
    expect(newlyKnown?.completedChapters).toBe(5);
    expect(newlyKnown?.updatedAt).toEqual(countTime);
  });

  test("idempotent identical submissions do not bump user updatedAt", async () => {
    const time1 = new Date("2026-03-31T10:00:00.000Z");
    currentTime = time1;

    const first = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 5 }),
      bindings,
    );
    expect((await first.json()).progress.updatedAt).toBe(time1.toISOString());

    const time2 = new Date("2026-03-31T12:00:00.000Z");
    currentTime = time2;

    const second = await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { completedChapters: 5 }),
      bindings,
    );
    // Identical submission must not bump updatedAt
    expect((await second.json()).progress.updatedAt).toBe(time1.toISOString());
  });

  test("is independent from collections lifecycle and clears cleanly", async () => {
    // 1. Setting progress does not create collection
    await app.request(
      "/me/progress/42",
      privateRequest("PUT", "alice", { stage: "in_progress", completedChapters: 3 }),
      bindings,
    );
    const collectionsBefore = await app.request("/me/collections", privateRequest(), bindings);
    expect((await collectionsBefore.json()).data).toEqual([]);

    // 2. Adding and then deleting collection does not remove progress
    await app.request("/me/collections/42", privateRequest("PUT", "alice"), bindings);
    await app.request("/me/collections/42", privateRequest("DELETE", "alice"), bindings);

    const progressAfter = await app.request("/me/progress", privateRequest(), bindings);
    expect((await progressAfter.json()).data).toHaveLength(1);

    // 3. Detail exposes both collection and progress
    await app.request("/me/collections/42", privateRequest("PUT", "alice"), bindings);
    const detail = await app.request("/me/subjects/42", privateRequest(), bindings);
    expect(await detail.json()).toMatchObject({
      collected: true,
      progress: {
        stage: "in_progress",
        completedChapters: 3,
        totalChapters: 12,
      },
    });

    // 4. Clearing progress removes progress record, keeps collection
    const clearRes = await app.request(
      "/me/progress/42",
      privateRequest("DELETE", "alice"),
      bindings,
    );
    expect(clearRes.status).toBe(200);
    expect(await clearRes.json()).toEqual({ progress: null });

    const detailAfterClear = await app.request("/me/subjects/42", privateRequest(), bindings);
    expect(await detailAfterClear.json()).toMatchObject({
      collected: true,
      progress: null,
    });
  });
});

describe("auth HTTP boundary", () => {
  test("keeps authentication unavailable without secrets", async () => {
    const unconfiguredApp = createApp();
    const response = await unconfiguredApp.request("/auth/status", {}, bindings);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("exposes availability and credentialed CORS only to the configured Web origin", async () => {
    const allowed = await app.request(
      "/auth/status",
      { headers: { Origin: bindings.WEB_ORIGIN } },
      bindings,
    );
    const denied = await app.request(
      "/auth/status",
      { headers: { Origin: "https://evil.example" } },
      bindings,
    );

    expect(await allowed.json()).toEqual({ available: true });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(bindings.WEB_ORIGIN);
    expect(allowed.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("starts the configured provider with a safe return target", async () => {
    const response = await app.request(
      "/api/auth/sign-in/social",
      privateRequest("POST", "alice", {
        provider: "easy-auth",
        callbackURL: `${bindings.WEB_ORIGIN}/collections`,
      }),
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      provider: "easy-auth",
      callbackURL: `${bindings.WEB_ORIGIN}/collections`,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("rejects external and non-allowlisted login return targets", async () => {
    for (const targets of [
      { callbackURL: "https://evil.example" },
      { callbackURL: `${bindings.WEB_ORIGIN}/admin` },
      {
        callbackURL: `${bindings.WEB_ORIGIN}/collections`,
        errorCallbackURL: "https://evil.example/login-error",
      },
    ]) {
      const response = await app.request(
        "/api/auth/sign-in/social",
        privateRequest("POST", "alice", { provider: "easy-auth", ...targets }),
        bindings,
      );
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_RETURN_TARGET");
    }
  });
});
