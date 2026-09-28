import { describe, expect, test, vi } from "vitest";

import { createUpstreamClient } from "./upstream-client";

const now = new Date("2026-09-13T12:00:00.000Z");

function request(id: number) {
  return new Request(`https://api.example.test/v0/characters/${id}`);
}

describe("shared upstream client", () => {
  test("caps background work at half of the per-minute budget", async () => {
    const fetch = vi.fn(async () => Response.json({}));
    const client = createUpstreamClient(fetch, () => now);

    for (let id = 1; id <= 15; id += 1) {
      await client.load(request(id), { gated: true, priority: "background" });
    }
    await expect(
      client.load(request(16), { gated: true, priority: "background" }),
    ).rejects.toMatchObject({ status: 429, code: "UPSTREAM_RATE_LIMITED" });

    const foreground = await client.load(request(17), { gated: true, priority: "foreground" });
    expect(foreground.response.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(16);
  });

  test("never queues background work behind busy concurrency slots", async () => {
    const pending: Array<() => void> = [];
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          pending.push(() => resolve(Response.json({})));
        }),
    );
    const client = createUpstreamClient(fetch, () => now);

    const foreground = [1, 2, 3, 4].map((id) =>
      client.load(request(id), { gated: true, priority: "foreground" }),
    );
    await vi.waitFor(() => expect(pending).toHaveLength(4));

    await expect(
      client.load(request(5), { gated: true, priority: "background" }),
    ).rejects.toMatchObject({ status: 429 });

    for (const resolve of pending) resolve();
    await Promise.all(foreground);
  });

  test("limits maintenance to two upstream requests per hour", async () => {
    const fetch = vi.fn(async () => Response.json({}));
    const client = createUpstreamClient(fetch, () => now);

    await client.load(request(1), { gated: true, priority: "maintenance" });
    await client.load(request(2), { gated: true, priority: "maintenance" });
    await expect(
      client.load(request(3), { gated: true, priority: "maintenance" }),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("does not spend the budget on ungated requests", async () => {
    const fetch = vi.fn(async () => Response.json({}));
    const client = createUpstreamClient(fetch, () => now);

    for (let id = 1; id <= 5; id += 1) {
      await client.load(request(id), { gated: false, priority: "maintenance" });
    }
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
