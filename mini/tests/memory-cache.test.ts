import { describe, expect, test } from "bun:test";

import { MemoryCache } from "../miniprogram/lib/memory-cache";

describe("MemoryCache", () => {
  test("expires values after their ttl", () => {
    const cache = new MemoryCache();
    cache.set("schedule", "value", 100, 1_000);
    expect(cache.get("schedule", 1_099)).toBe("value");
    expect(cache.get("schedule", 1_100)).toBeUndefined();
  });

  test("deduplicates concurrent loads", async () => {
    const cache = new MemoryCache();
    let loads = 0;
    const loader = async () => {
      loads += 1;
      await Promise.resolve();
      return "value";
    };

    const [first, second] = await Promise.all([
      cache.load("rankings", 1_000, loader),
      cache.load("rankings", 1_000, loader),
    ]);

    expect(first).toBe("value");
    expect(second).toBe("value");
    expect(loads).toBe(1);
  });
});

describe("MemoryCache capacity", () => {
  test("evicts the least recently used entry beyond its capacity", () => {
    const cache = new MemoryCache(2);
    cache.set("a", 1, 1_000, 0);
    cache.set("b", 2, 1_000, 0);
    expect(cache.get("a", 1)).toBe(1);
    cache.set("c", 3, 1_000, 1);
    expect(cache.get("b", 2)).toBeUndefined();
    expect(cache.get("a", 2)).toBe(1);
    expect(cache.get("c", 2)).toBe(3);
  });
});
