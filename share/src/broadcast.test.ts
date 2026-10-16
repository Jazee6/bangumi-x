import { describe, expect, test } from "bun:test";

import { getBroadcastDisplay, getBroadcastSummary } from "./index";

describe("getBroadcastDisplay", () => {
  test("formats today, tomorrow, and later natural-day countdowns", () => {
    const broadcast = {
      chapters: [
        { sequence: 8, date: "2026-09-19" },
        { sequence: 9, date: "2026-09-20" },
      ],
      completeAfter: null,
    };

    expect(getBroadcastDisplay(broadcast, "2026-09-19")).toMatchObject({
      progressText: "今天播放第 8 话",
      detailText: "今天 · 第 8 话",
    });
    expect(getBroadcastDisplay(broadcast, "2026-09-18")).toMatchObject({
      progressText: "明天播放第 8 话",
    });
    expect(getBroadcastDisplay(broadcast, "2026-09-16")).toMatchObject({
      progressText: "3 天后播放第 8 话",
    });
  });

  test("compresses continuous same-day sequences and lists non-continuous ones", () => {
    expect(
      getBroadcastDisplay(
        {
          chapters: [
            { sequence: 7, date: "2026-09-19" },
            { sequence: 8, date: "2026-09-19" },
          ],
          completeAfter: null,
        },
        "2026-09-19",
      )?.progressText,
    ).toBe("今天播放第 7–8 话");

    expect(
      getBroadcastDisplay(
        {
          chapters: [
            { sequence: 7, date: "2026-09-19" },
            { sequence: 9, date: "2026-09-19" },
            { sequence: 9.5, date: "2026-09-19" },
          ],
          completeAfter: null,
        },
        "2026-09-19",
      )?.progressText,
    ).toBe("今天播放第 7、9、9.5 话");
  });

  test("keeps the final chapter upcoming all day and completes the next day", () => {
    const broadcast = {
      chapters: [{ sequence: 12, date: "2026-09-19" }],
      completeAfter: "2026-09-19",
    };

    expect(getBroadcastDisplay(broadcast, "2026-09-19")?.kind).toBe("upcoming");
    expect(getBroadcastDisplay(broadcast, "2026-09-20")).toEqual({
      kind: "completed",
      date: "2026-09-19",
      detailText: "已完结",
      progressText: "已完结",
    });
  });

  test("omits unknown broadcast information", () => {
    expect(
      getBroadcastDisplay(
        { chapters: [{ sequence: 1, date: "2026-09-18" }], completeAfter: null },
        "2026-09-19",
      ),
    ).toBeNull();
  });
});

describe("getBroadcastSummary", () => {
  const broadcast = {
    chapters: [
      { sequence: 4, date: "2026-10-11" },
      { sequence: 5, date: "2026-10-18" },
      { sequence: 6, date: "2026-10-18" },
    ],
    completeAfter: "2026-10-18",
  };

  test("writes the next chapter with an absolute China Standard Time date", () => {
    // 2026-10-17T17:00Z is already October 18 in China Standard Time.
    expect(getBroadcastSummary(broadcast, new Date("2026-10-17T17:00:00.000Z"))).toBe(
      "第 5–6 话 10月18日放送",
    );
    expect(getBroadcastSummary(broadcast, new Date("2026-10-12T00:00:00.000Z"))).toBe(
      "第 5–6 话 10月18日放送",
    );
  });

  test("summarizes a confirmed completion and omits missing data", () => {
    expect(getBroadcastSummary(broadcast, new Date("2026-10-20T00:00:00.000Z"))).toBe(
      "已完结，共 3 话",
    );
    expect(getBroadcastSummary(null)).toBeNull();
    expect(
      getBroadcastSummary(
        { chapters: [{ sequence: 1, date: "2026-01-01" }], completeAfter: null },
        new Date("2026-10-20T00:00:00.000Z"),
      ),
    ).toBeNull();
  });
});
