import { expect, test } from "bun:test";

import type { IsoWeekday, ScheduleResponse } from "share";

import { publicPageCache } from "../miniprogram/lib/memory-cache";
import type { PosterViewModel } from "../miniprogram/lib/view-models";

interface SchedulePage {
  schedule: ScheduleResponse | null;
  data: {
    items: PosterViewModel[];
    selectedWeekday: IsoWeekday;
    loaded: boolean;
    loading: boolean;
    errorMessage: string;
  };
  setData(patch: Partial<SchedulePage["data"]>): void;
  loadSchedule(): Promise<void>;
  onSelectWeekday(event: { detail: { value: IsoWeekday } }): void;
}

test("schedule filters blocked subjects on initial render, weekday changes and cached reloads", async () => {
  const previousPage = globalThis.Page;
  const previousWx = globalThis.wx;
  let page!: SchedulePage;
  globalThis.Page = ((definition: SchedulePage) => {
    page = definition;
    page.setData = (patch) => Object.assign(page.data, patch);
  }) as unknown as typeof Page;
  globalThis.wx = { setNavigationBarTitle() {} } as unknown as typeof wx;

  const blocked = { id: 630160, title: "Blocked", imageUrl: null, score: null };
  const allowed = { id: 2, title: "Allowed", imageUrl: null, score: null };
  const schedule: ScheduleResponse = {
    days: [
      { weekday: 1, items: [blocked, allowed] },
      { weekday: 2, items: [blocked] },
    ],
  };
  publicPageCache.clear();
  publicPageCache.set("schedule", schedule, 60_000);
  publicPageCache.set("contentPolicy", { blockedSubjectIds: [630160] }, 60_000);

  try {
    await import("../miniprogram/pages/index/index");
    page.data.selectedWeekday = 1;
    await page.loadSchedule();
    expect(page.data.items.map((item) => item.id)).toEqual([2]);
    expect(page.data.loaded).toBe(true);
    expect(page.data.loading).toBe(false);
    expect(page.data.errorMessage).toBe("");

    page.onSelectWeekday({ detail: { value: 2 } });
    expect(page.data.items).toEqual([]);
    await page.loadSchedule();
    expect(page.data.items).toEqual([]);

    page.onSelectWeekday({ detail: { value: 1 } });
    expect(page.data.items.map((item) => item.id)).toEqual([2]);
    await page.loadSchedule();
    expect(page.data.items.map((item) => item.id)).toEqual([2]);
    expect(publicPageCache.get("schedule")).toEqual(schedule);
  } finally {
    publicPageCache.clear();
    globalThis.Page = previousPage;
    globalThis.wx = previousWx;
  }
});
