import { describe, expect, test } from "bun:test";

import { personalPageQuery, SAFE_CONTENT_QUERY } from "../miniprogram/lib/personal-records";

describe("Mini personal-record request contracts", () => {
  test("always excludes Mini-restricted subjects before paging", () => {
    expect(SAFE_CONTENT_QUERY).toEqual({ excludeNsfw: true });
    expect(personalPageQuery(2)).toEqual({
      excludeNsfw: true,
      page: 2,
      pageSize: 24,
      keyword: undefined,
      list: undefined,
      stage: undefined,
      type: undefined,
    });
  });

  test("preserves collection and progress filters", () => {
    expect(
      personalPageQuery(1, {
        keyword: "高达",
        list: "unlisted",
        stage: "in_progress",
        type: "anime",
      }),
    ).toEqual({
      excludeNsfw: true,
      page: 1,
      pageSize: 24,
      keyword: "高达",
      list: "unlisted",
      stage: "in_progress",
      type: "anime",
    });
  });
});
