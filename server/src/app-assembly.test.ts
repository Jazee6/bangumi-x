import { expect, vi, test } from "vitest";

import { createApp } from "./index";

import type { AuthBoundary } from "./auth";
import type { CollectionRepository } from "./collections";

const unavailableAuth: AuthBoundary = {
  isAvailable: () => false,
  handler: async () => new Response(null, { status: 503 }),
  getSession: async () => null,
};

const unusedCollections = {} as CollectionRepository;
const upstream = vi.fn(async () => new Response(null, { status: 503 }));
const app = createApp({
  auth: unavailableAuth,
  collections: () => unusedCollections,
  fetch: upstream,
  now: () => new Date("2026-09-07T00:00:00Z"),
});
const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
};

test("assembles every route responsibility without omissions or shadowing", async () => {
  const expectations = [
    ["/schedule", 502],
    ["/rankings", 502],
    ["/discover/popular?type=anime&year=2026&page=1&pageSize=24", 502],
    ["/subjects/1", 502],
    ["/subjects/1/chapters", 502],
    ["/chapters/1", 502],
    ["/persons/1", 502],
    ["/characters/1", 502],
    ["/images?url=invalid", 400],
    ["/og/brand", 200],
    ["/og/brand?title=invalid", 400],
    ["/og/subjects/1", 502],
    ["/auth/status", 200],
    ["/me/collections", 401],
  ] as const;

  for (const [path, status] of expectations) {
    const response = await app.request(path, {}, bindings);
    expect(response.status, path).toBe(status);
  }
});
