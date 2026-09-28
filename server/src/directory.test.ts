import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createD1DirectoryRepository, createMemoryDirectoryRepository } from "./directory";

describe("demand-driven public directory", () => {
  test("keeps first discovery time and never treats pending discovery as verification", async () => {
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
        discoverySource: "annual_popular",
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

  test("skips unchanged rows and re-verifies at most once a day", async () => {
    const repository = createD1DirectoryRepository(env.DB);
    const first = new Date("2026-02-01T00:00:00.000Z");
    const pending = Array.from({ length: 150 }, (_, index) => ({
      resourceType: "chapter" as const,
      externalId: `d1-${index}`,
      discoverySource: "relation" as const,
      indexStatus: "pending" as const,
      indexReason: "chapter_unverified",
    }));
    const verified = {
      resourceType: "chapter" as const,
      externalId: "d1-0",
      discoverySource: "direct_access" as const,
      indexStatus: "index" as const,
      indexReason: "chapter_verified",
    };
    const verifiedAt = async () =>
      (
        await env.DB.prepare(
          "select last_verified_at as value from public_entity_directory where external_id = 'd1-0'",
        ).first<{ value: number | null }>()
      )?.value;

    await repository.recordDiscoveries(pending, first);
    await repository.recordDiscoveries([verified], first);
    const count = await env.DB.prepare(
      "select count(*) as value from public_entity_directory where external_id like 'd1-%'",
    ).first<{ value: number }>();
    expect(count?.value).toBe(150);

    await repository.recordDiscoveries([verified], new Date("2026-02-01T12:00:00.000Z"));
    expect(await verifiedAt()).toBe(first.getTime());

    const nextDay = new Date("2026-02-02T00:00:00.000Z");
    await repository.recordDiscoveries([verified], nextDay);
    expect(await verifiedAt()).toBe(nextDay.getTime());

    const later = new Date("2026-02-02T01:00:00.000Z");
    await repository.recordDiscoveries(
      [{ ...verified, indexStatus: "noindex", indexReason: "not_found" }],
      later,
    );
    expect(await verifiedAt()).toBe(later.getTime());
  });
});
