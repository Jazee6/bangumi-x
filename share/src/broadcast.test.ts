import { describe, expect, test } from "bun:test";

import { getBroadcastDisplay } from "./index";

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
