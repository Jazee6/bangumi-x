import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createD1DirectoryRepository, createMemoryDirectoryRepository } from "./directory";

describe("demand-driven public directory", () => {
  test("keeps first discovery time and source, and never treats pending discovery as verification", async () => {
    const repository = createMemoryDirectoryRepository();
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");
    const third = new Date("2026-01-03T00:00:00.000Z");

    await repository.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "42",
          discoverySource: "daily_broadcast",
          indexStatus: "pending",
          indexReason: "schedule_unverified",
        },
      ],
      first,
    );
    await repository.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "42",
          discoverySource: "annual_popular",
          indexStatus: "index",
          indexReason: "annual_popular_ranked",
        },
      ],
      second,
    );
    await repository.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "42",
          discoverySource: "daily_broadcast",
          indexStatus: "pending",
          indexReason: "schedule_unverified",
        },
      ],
      third,
    );

    expect(
      await repository.listEntries({
        resourceType: "subject",
        indexStatus: "index",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([
      {
        resourceType: "subject",
        externalId: "42",
        discoverySource: "daily_broadcast",
        indexStatus: "index",
        indexReason: "annual_popular_ranked",
        firstDiscoveredAt: first,
        lastVerifiedAt: second,
      },
    ]);
  });

  test("returns deterministic bounded pages without content fields", async () => {
    const repository = createMemoryDirectoryRepository();
    const now = new Date("2026-01-01T00:00:00.000Z");
    await repository.recordDiscoveries(
      ["2", "1", "3"].map((externalId) => ({
        resourceType: "subject" as const,
        externalId,
        discoverySource: "annual_popular" as const,
        indexStatus: "index" as const,
        indexReason: "annual_popular_ranked",
      })),
      now,
    );

    const page = await repository.listEntries({ resourceType: "subject", limit: 2, offset: 1 });
    expect(page.map((entry) => entry.externalId)).toEqual(["2", "3"]);
    expect(JSON.stringify(page)).not.toContain("title");
    expect(JSON.stringify(page)).not.toContain("imageUrl");
  });

  test("provides stable cursor pages, stale selection, and durable sync state", async () => {
    const repository = createMemoryDirectoryRepository();
    const old = new Date("2026-01-01T00:00:00.000Z");
    const fresh = new Date("2026-02-01T00:00:00.000Z");
    await repository.recordDiscoveries(
      ["1", "2", "3"].map((externalId) => ({
        resourceType: "subject" as const,
        externalId,
        discoverySource: "direct_access" as const,
        indexStatus: "index" as const,
        indexReason: "subject_verified",
      })),
      old,
    );
    await repository.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "3",
          discoverySource: "direct_access",
          indexStatus: "index",
          indexReason: "subject_verified",
        },
        {
          resourceType: "character",
          externalId: "9",
          discoverySource: "relation",
          indexStatus: "pending",
          indexReason: "character_unverified",
        },
      ],
      fresh,
      { reverify: true },
    );

    const firstPage = await repository.listPage({ resourceType: "subject", limit: 2 });
    expect(firstPage.entries.map((entry) => entry.externalId)).toEqual(["1", "2"]);
    expect(firstPage.nextCursor).toBe("2");
    const secondPage = await repository.listPage({
      resourceType: "subject",
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.entries.map((entry) => entry.externalId)).toEqual(["3"]);
    expect(secondPage.nextCursor).toBeNull();

    const stale = await repository.listStaleEntries({
      resourceTypes: ["subject", "character"],
      verifiedBefore: new Date("2026-01-15T00:00:00.000Z"),
      limit: 10,
    });
    expect(stale.map((entry) => `${entry.resourceType}:${entry.externalId}`)).toEqual([
      "character:9",
      "subject:1",
      "subject:2",
    ]);
    expect(stale[0]?.lastVerifiedAt).toBeNull();

    expect(await repository.getSyncState("rankings_cursor")).toBeNull();
    await repository.setSyncState("rankings_cursor", "2025/autumn", fresh);
    expect(await repository.getSyncState("rankings_cursor")).toEqual({
      value: "2025/autumn",
      updatedAt: fresh,
    });
  });
});

describe("D1 public directory writes", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });

  test("writes only new indexable rows, decision changes and weekly maintenance re-verification", async () => {
    const repository = createD1DirectoryRepository(env.DB);
    const first = new Date("2026-02-01T00:00:00.000Z");
    const pending = Array.from({ length: 150 }, (_, index) => ({
      resourceType: "collection_list" as const,
      externalId: `d1-${index}`,
      discoverySource: "daily_broadcast" as const,
      indexStatus: "pending" as const,
      indexReason: "schedule_unverified",
    }));
    const verified = {
      resourceType: "collection_list" as const,
      externalId: "d1-0",
      discoverySource: "direct_access" as const,
      indexStatus: "index" as const,
      indexReason: "subject_verified",
    };
    const row = (externalId = "d1-0") =>
      env.DB.prepare(
        "select last_verified_at as verifiedAt, discovery_source as source, index_status as status from public_entity_directory where external_id = ?",
      )
        .bind(externalId)
        .first<{ verifiedAt: number | null; source: string; status: string }>();
    const verifiedAt = async () => (await row())?.verifiedAt;

    await repository.recordDiscoveries(pending, first);
    await repository.recordDiscoveries([verified], first);
    const count = await env.DB.prepare(
      "select count(*) as value from public_entity_directory where external_id like 'd1-%'",
    ).first<{ value: number }>();
    expect(count?.value).toBe(150);
    expect(await row()).toEqual({
      verifiedAt: first.getTime(),
      source: "daily_broadcast",
      status: "index",
    });

    // Ordinary visits never refresh an unchanged row, however old.
    await repository.recordDiscoveries([verified], new Date("2026-03-01T00:00:00.000Z"));
    expect(await verifiedAt()).toBe(first.getTime());

    await repository.recordDiscoveries([verified], new Date("2026-02-07T12:00:00.000Z"), {
      reverify: true,
    });
    expect(await verifiedAt()).toBe(first.getTime());
    const nextWeek = new Date("2026-02-08T00:00:00.000Z");
    await repository.recordDiscoveries([verified], nextWeek, { reverify: true });
    expect(await verifiedAt()).toBe(nextWeek.getTime());

    const later = new Date("2026-02-08T01:00:00.000Z");
    await repository.recordDiscoveries(
      [{ ...verified, indexStatus: "noindex", indexReason: "not_found" }],
      later,
      { existingOnly: true },
    );
    expect(await row()).toMatchObject({ verifiedAt: later.getTime(), status: "noindex" });

    await repository.recordDiscoveries(
      [
        { ...verified, externalId: "d1-new-noindex", indexStatus: "noindex", indexReason: "nsfw" },
        { ...verified, externalId: "d1-crawled" },
      ],
      later,
      { existingOnly: false },
    );
    await repository.recordDiscoveries([{ ...verified, externalId: "d1-crawled-only" }], later, {
      existingOnly: true,
    });
    expect(await row("d1-new-noindex")).toBeNull();
    expect(await row("d1-crawled")).toMatchObject({ status: "index" });
    expect(await row("d1-crawled-only")).toBeNull();
  });
  test("selects stale entries in the same order as the memory repository", async () => {
    const d1 = createD1DirectoryRepository(env.DB);
    const memory = createMemoryDirectoryRepository();
    const old = new Date("2026-03-01T00:00:00.000Z");
    const older = new Date("2026-02-01T00:00:00.000Z");
    const fresh = new Date("2026-04-01T00:00:00.000Z");
    const discoveries = [
      { at: older, resourceType: "person", externalId: "st-2", indexStatus: "index" },
      { at: old, resourceType: "subject", externalId: "st-3", indexStatus: "noindex" },
      { at: old, resourceType: "subject", externalId: "st-1", indexStatus: "index" },
      { at: fresh, resourceType: "subject", externalId: "st-4", indexStatus: "index" },
      { at: fresh, resourceType: "subject", externalId: "st-6", indexStatus: "pending" },
      { at: fresh, resourceType: "character", externalId: "st-5", indexStatus: "pending" },
    ] as const;
    for (const repository of [d1, memory]) {
      for (const { at, ...item } of discoveries) {
        await repository.recordDiscoveries(
          [{ ...item, discoverySource: "direct_access", indexReason: "stale_order" }],
          at,
        );
      }
    }

    const query = {
      resourceTypes: ["subject", "character", "person"] as const,
      verifiedBefore: old,
      limit: 10,
    };
    const keys = (entries: Awaited<ReturnType<typeof d1.listStaleEntries>>) =>
      entries
        .filter((entry) => entry.indexReason === "stale_order")
        .map((entry) => `${entry.resourceType}:${entry.externalId}`);
    const expected = ["character:st-5", "subject:st-6", "person:st-2", "subject:st-1"];
    expect(keys(await memory.listStaleEntries(query))).toEqual(expected);
    expect(keys(await d1.listStaleEntries(query))).toEqual(expected);
    expect(
      keys(await d1.listStaleEntries({ ...query, resourceTypes: ["subject"], limit: 2 })),
    ).toEqual(["subject:st-6", "subject:st-1"]);
  });

  test("lists seed subjects after a cursor in the same order as the memory repository", async () => {
    const d1 = createD1DirectoryRepository(env.DB);
    const memory = createMemoryDirectoryRepository();
    const first = new Date("2026-05-01T00:00:00.000Z");
    const second = new Date("2026-05-02T00:00:00.000Z");
    const discoveries = [
      { at: second, externalId: "sd-1", discoverySource: "daily_broadcast", indexStatus: "index" },
      { at: first, externalId: "sd-3", discoverySource: "daily_broadcast", indexStatus: "index" },
      { at: first, externalId: "sd-2", discoverySource: "daily_broadcast", indexStatus: "index" },
      { at: first, externalId: "sd-4", discoverySource: "rankings", indexStatus: "index" },
      { at: first, externalId: "sd-5", discoverySource: "daily_broadcast", indexStatus: "pending" },
    ] as const;
    for (const repository of [d1, memory]) {
      for (const { at, ...item } of discoveries) {
        await repository.recordDiscoveries(
          [{ ...item, resourceType: "subject", indexReason: "seed_order" }],
          at,
        );
      }
    }

    const ids = (entries: Awaited<ReturnType<typeof d1.listSeedSubjects>>) =>
      entries
        .filter((entry) => entry.indexReason === "seed_order")
        .map((entry) => entry.externalId);
    for (const repository of [d1, memory]) {
      expect(
        ids(
          await repository.listSeedSubjects({
            discoverySource: "daily_broadcast",
            after: null,
            limit: 10,
          }),
        ),
      ).toEqual(["sd-2", "sd-3", "sd-5", "sd-1"]);
      expect(
        ids(
          await repository.listSeedSubjects({
            discoverySource: "daily_broadcast",
            after: { firstDiscoveredAt: first, externalId: "sd-2" },
            limit: 1,
          }),
        ),
      ).toEqual(["sd-3"]);
    }
  });
});
