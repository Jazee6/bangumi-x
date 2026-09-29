import { createFileRoute, notFound } from "@tanstack/react-router";
import type { SourceMetadata, WeekdaySlug } from "share";
import { WEEKDAY_BY_SLUG, WEEKDAY_LABELS, WEEKDAY_SLUGS } from "share";

import { scheduleQueryOptions } from "@/features/schedule/schedule-query";
import { ScheduleLoading } from "@/features/schedule/schedule-states";
import { ScheduleView } from "@/features/schedule/schedule-view";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildPageHead,
  CACHE_CONTROL,
  NOT_FOUND_HEADERS,
} from "@/lib/seo";

export const Route = createFileRoute("/_app/_schedule/schedule/$weekday")({
  loader: async ({ context, params }) => {
    if (!WEEKDAY_SLUGS.includes(params.weekday as WeekdaySlug)) {
      throw notFound({
        headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
      });
    }
    const schedule = await context.queryClient.query({
      ...scheduleQueryOptions,
      staleTime: "static",
    });
    const weekday = params.weekday as WeekdaySlug;
    const source: SourceMetadata | undefined = schedule.fetchedAt
      ? { url: "https://bgm.tv/calendar", fetchedAt: schedule.fetchedAt }
      : undefined;
    return {
      schedule,
      weekday,
      day: schedule.days[WEEKDAY_BY_SLUG[weekday] - 1],
      source,
    };
  },
  headers: ({ params }) => {
    if (!WEEKDAY_SLUGS.includes(params.weekday as WeekdaySlug)) {
      return NOT_FOUND_HEADERS;
    }
    return {
      "Cache-Control": CACHE_CONTROL.detail,
    };
  },
  head: ({ loaderData, params }) => {
    if (!WEEKDAY_SLUGS.includes(params.weekday as WeekdaySlug) || !loaderData) {
      return buildPageHead({
        publication: { state: "not-found", reason: "invalid-weekday" },
      });
    }
    const weekday = params.weekday as WeekdaySlug;
    const label = WEEKDAY_LABELS[WEEKDAY_BY_SLUG[weekday]];
    return buildPageHead({
      title: `${label}每日放送`,
      description: `Bangumi X ${label}每周放送编排与公开条目。`,
      canonicalPath: `/schedule/${weekday}`,
      jsonLd: [
        buildBreadcrumbJsonLd([
          { name: "每日放送", path: "/" },
          { name: label, path: `/schedule/${weekday}` },
        ]),
        buildItemListJsonLd(loaderData.day?.items ?? []),
      ],
    });
  },
  component: SchedulePage,
});

function SchedulePage() {
  const { schedule, day } = Route.useLoaderData();
  if (!day) return <ScheduleLoading />;

  return (
    <ScheduleView
      schedule={schedule}
      selectedWeekday={day.weekday}
      showAllDaysBeforeHydration={false}
    />
  );
}
