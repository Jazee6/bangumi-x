import { describe, expect, test, vi } from "vitest";

import { createMemoryDirectoryRepository } from "./directory";
import { createApp } from "./index";
import { selectKeyCharacterDiscoveries, selectKeyPersonDiscoveries } from "./relation-seeding";

function character(id: number, relation: string, actorIds: number[] = []) {
  return {
    id,
    name: `角色 ${id}`,
    type: 1,
    relation,
    actors: actorIds.map((actorId) => ({ id: actorId, name: `演员 ${actorId}`, type: 1 })),
  };
}

function person(id: number, relation: string) {
  return { id, name: `人物 ${id}`, type: 1, relation, career: [], eps: "" };
}

const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
};

describe("key character and person seeding", () => {
  test("takes the first ten main or supporting characters and each first actor", () => {
    const discoveries = selectKeyCharacterDiscoveries({
      total: 14,
      groups: [
        {
          relation: "主角",
          items: [1, 2].map((id) => ({
            id,
            name: `角色 ${id}`,
            type: "角色" as const,
            imageUrl: null,
            actors: [
              { id: 100 + id, name: `演员 ${id}`, type: "个人" as const },
              { id: 200 + id, name: `配音 ${id}`, type: "个人" as const },
            ],
          })),
        },
        {
          relation: "配角",
          items: [3, 4, 5, 6, 7, 8, 9, 10, 11].map((id) => ({
            id,
            name: `角色 ${id}`,
            type: "角色" as const,
            imageUrl: null,
            actors: [],
          })),
        },
        {
          relation: "客串",
          items: [{ id: 12, name: "角色 12", type: "角色" as const, imageUrl: null, actors: [] }],
        },
      ],
    });

    expect(
      discoveries
        .filter((item) => item.resourceType === "character")
        .map((item) => item.externalId),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(
      discoveries.filter((item) => item.resourceType === "person").map((item) => item.externalId),
    ).toEqual(["101", "102"]);
    expect(discoveries[0]).toMatchObject({
      discoverySource: "relation",
      indexStatus: "index",
      indexReason: "character_verified",
    });
  });

  test("takes only the six key staff relations", () => {
    const discoveries = selectKeyPersonDiscoveries({
      total: 4,
      groups: ["导演", "原画", "动画制作", "音乐"].map((relation, index) => ({
        relation,
        items: [
          {
            id: index + 1,
            name: `人物 ${index + 1}`,
            type: "个人" as const,
            careers: [],
            chapters: null,
            imageUrl: null,
          },
        ],
      })),
    });

    expect(discoveries.map((item) => item.externalId)).toEqual(["1", "3", "4"]);
    expect(discoveries[0]?.indexReason).toBe("person_verified");
  });

  test("records key entities only for maintenance requests", async () => {
    const directory = createMemoryDirectoryRepository();
    const fetch = vi.fn(async (input: string | URL | Request) =>
      new URL(String(input)).pathname.endsWith("/characters")
        ? Response.json([character(1, "主角", [101]), character(2, "闲角", [102])])
        : Response.json([person(201, "导演"), person(202, "原画")]),
    );
    const app = createApp({
      fetch,
      now: () => new Date("2026-10-15T00:00:00.000Z"),
      random: () => 1,
      directory: () => directory,
    });

    for (const path of ["/subjects/9/characters", "/subjects/9/persons"]) {
      await app.request(path, {}, bindings);
    }
    const ids = async (resourceType: "character" | "person") =>
      (await directory.listEntries({ resourceType, limit: 10 })).map((entry) => entry.externalId);
    expect(await ids("character")).toEqual([]);
    expect(await ids("person")).toEqual([]);

    for (const path of ["/subjects/9/characters", "/subjects/9/persons"]) {
      await app.request(path, { headers: { "X-Bangumi-Maintenance": "1" } }, bindings);
    }
    expect(await ids("character")).toEqual(["1"]);
    expect(await ids("person")).toEqual(["101", "201"]);
  });
});
