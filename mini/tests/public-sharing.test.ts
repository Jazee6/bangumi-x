import { describe, expect, test } from "bun:test";

import {
  collectionShare,
  detailShare,
  discoverShare,
  rankingsShare,
  scheduleShare,
} from "../miniprogram/lib/public-sharing";

(globalThis as typeof globalThis & { wx: unknown }).wx = {
  getAccountInfoSync: () => ({ miniProgram: { envVersion: "release" } }),
};

describe("public sharing", () => {
  test("direct detail links and matching mini OG formats", () => {
    const share = detailShare("subject", 12, "条目名");
    expect(share.friend.path).toBe("/pages/subjects/detail/index?id=12");
    expect(share.timeline.query).toBe("id=12");
    expect(share.friend.imageUrl).toBe("https://s.bgmx.jaze.top/og/subjects/12?mini=friend");
    expect(share.timeline.imageUrl).toBe("https://s.bgmx.jaze.top/og/subjects/12?mini=timeline");
  });

  test("preserves public filters without pagination", () => {
    expect(scheduleShare(7).friend.path).toBe("/pages/index/index?weekday=7");
    expect(rankingsShare(2024, "spring").timeline.query).toBe("year=2024&season=spring");
    expect(discoverShare("characters", "anime", "少女 乐队").timeline.query).toBe(
      "tab=characters&type=anime&keyword=%E5%B0%91%E5%A5%B3%20%E4%B9%90%E9%98%9F",
    );
    expect(discoverShare("characters", "anime", "少女 乐队").friend.imageUrl).toContain(
      "/og/mini-search/characters?keyword=%E5%B0%91%E5%A5%B3%20%E4%B9%90%E9%98%9F&mini=friend",
    );
  });

  test("public list links do not include personal collection routes", () => {
    const share = collectionShare("a/b", "列表", "作者");
    expect(share.friend.path).toBe("/pages/collections/shared/index?shareId=a%2Fb");
    expect(share.timeline.query).toBe("shareId=a%2Fb");
    expect(share.timeline.imageUrl).toContain("/og/collection-lists/a%2Fb?mini=timeline");
  });
});
