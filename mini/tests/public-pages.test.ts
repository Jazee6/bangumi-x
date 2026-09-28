import { describe, expect, test } from "bun:test";

import { resolveServerUrl } from "../miniprogram/lib/config";
import {
  pagePatch,
  clampRankingSeason,
  getDiscoveryRequest,
  getLocalIsoWeekday,
  getRankingsRequest,
} from "../miniprogram/lib/public-pages";
import { buildRequestUrl } from "../miniprogram/lib/request";

describe("Mini public page request contracts", () => {
  test("builds encoded query strings", () => {
    expect(
      buildRequestUrl("https://s.bgmx.jaze.top/", "/discover/search/subjects", {
        keyword: "少女 乐队",
        page: 1,
        ignored: undefined,
      }),
    ).toBe(
      "https://s.bgmx.jaze.top/discover/search/subjects?keyword=%E5%B0%91%E5%A5%B3%20%E4%B9%90%E9%98%9F&page=1",
    );
  });

  test("uses popular subjects when the keyword is empty", () => {
    expect(getDiscoveryRequest("subjects", "anime", "  ", 1, 2026)).toEqual({
      path: "/discover/popular",
      query: { page: 1, pageSize: 24, type: "anime", year: 2026 },
    });
  });

  test("requires a keyword for characters and persons", () => {
    expect(getDiscoveryRequest("characters", "anime", "", 1, 2026)).toBeNull();
    expect(getDiscoveryRequest("persons", "anime", "声优", 2, 2026)).toEqual({
      path: "/discover/search/persons",
      query: { keyword: "声优", page: 2, pageSize: 24, type: undefined },
    });
  });

  test("builds ranking requests with the shared page size", () => {
    expect(getRankingsRequest(2025, "autumn", 2)).toEqual({
      path: "/rankings",
      query: { page: 2, pageSize: 24, season: "autumn", year: 2025 },
    });
  });
});

describe("Mini public page state helpers", () => {
  test("maps Sunday to ISO weekday 7", () => {
    expect(getLocalIsoWeekday(new Date(2026, 0, 4))).toBe(7);
    expect(getLocalIsoWeekday(new Date(2026, 0, 5))).toBe(1);
  });

  test("clamps future seasons only in the current year", () => {
    const now = new Date(2026, 4, 1);
    expect(clampRankingSeason(2026, "autumn", now)).toBe("spring");
    expect(clampRankingSeason(2025, "autumn", now)).toBe("autumn");
  });

  test("appends only new ids as render-path patches", () => {
    expect(
      pagePatch(
        "posters",
        [
          { id: 1, title: "A" },
          { id: 2, title: "B" },
        ],
        [
          { id: 2, title: "B2" },
          { id: 3, title: "C" },
        ],
        true,
      ),
    ).toEqual({ length: 3, patch: { "posters[2]": { id: 3, title: "C" } } });
    expect(pagePatch("posters", [{ id: 1 }], [{ id: 4 }, { id: 4 }], false)).toEqual({
      length: 1,
      patch: { posters: [{ id: 4 }] },
    });
  });
});

describe("Mini server URL selection", () => {
  test("uses local development in devtools and accepts a debug override", () => {
    expect(resolveServerUrl("develop", undefined, true)).toBe("http://127.0.0.1:8787");
    expect(resolveServerUrl("develop", "http://192.168.1.8:8787/")).toBe("http://192.168.1.8:8787");
  });

  test("uses production for develop builds outside devtools without an override", () => {
    expect(resolveServerUrl("develop")).toBe("https://s.bgmx.jaze.top");
    expect(resolveServerUrl("develop", "")).toBe("https://s.bgmx.jaze.top");
  });

  test("always uses production for trial and release", () => {
    expect(resolveServerUrl("trial", "http://192.168.1.8:8787")).toBe("https://s.bgmx.jaze.top");
    expect(resolveServerUrl("release", "http://192.168.1.8:8787")).toBe("https://s.bgmx.jaze.top");
  });
});
