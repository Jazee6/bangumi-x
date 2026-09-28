import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { IsoWeekday, SourceMetadata } from "share";

import { toast } from "@/components/ui/toast";

import { scheduleQueryOptions } from "@/features/schedule/schedule-query";
import { ScheduleError, ScheduleLoading } from "@/features/schedule/schedule-states";
import { ScheduleView } from "@/features/schedule/schedule-view";
import { getInitialWeekday, getIsoWeekday, isValidTimeZone } from "@/features/schedule/time-zone";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildPageHead,
  CACHE_CONTROL,
} from "@/lib/seo";

export const Route = createFileRoute("/_app/_schedule/")({
  loader: async ({ context }) => {
    const initialWeekday = getInitialWeekday();
    const schedule = await context.queryClient
      .query({ ...scheduleQueryOptions, staleTime: "static" })
      .catch(() => undefined);
    const source: SourceMetadata | undefined = schedule?.fetchedAt
      ? { url: "https://bgm.tv/calendar", fetchedAt: schedule.fetchedAt }
      : undefined;
    return { initialWeekday, schedule, source };
  },
  headers: () => ({
    "Cache-Control": CACHE_CONTROL.detail,
  }),
  head: ({ loaderData }) =>
    buildPageHead({
      title: "每日放送",
      description: "按星期浏览 Bangumi 动画每周每日放送编排，一次查看星期一至星期日的公开条目。",
      canonicalPath: "/",
      jsonLd: [
        buildBreadcrumbJsonLd([{ name: "每日放送", path: "/" }]),
        buildItemListJsonLd(loaderData?.schedule?.days.flatMap((day) => day.items) ?? []),
      ],
    }),
  component: Home,
});

function Home() {
  const { initialWeekday } = Route.useLoaderData();
  const [selectedWeekday, setSelectedWeekday] = useState<IsoWeekday>(initialWeekday);
  const { data, error, isError, isFetching, isPending, refetch } = useQuery(scheduleQueryOptions);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("authError")) {
      toast.add({
        id: "auth-error",
        title: "登录暂时无法完成，请重试。",
        type: "error",
        priority: "high",
      });
      searchParams.delete("authError");
      const search = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${search}${window.location.hash}`,
      );
    }

    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(browserTimeZone)) {
      return;
    }

    setSelectedWeekday(getIsoWeekday(browserTimeZone));
  }, []);

  return (
    <>
      {isPending && <ScheduleLoading />}
      {isError && (
        <ScheduleError
          message={error.message}
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      )}
      {data && <ScheduleView schedule={data} selectedWeekday={selectedWeekday} />}
    </>
  );
}
