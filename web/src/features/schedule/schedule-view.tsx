import { Link } from "@tanstack/react-router";
import { ImageOff } from "lucide-react";

import { WEEKDAY_LABELS, WEEKDAY_SLUG_BY_ISO, type ScheduleResponse, type IsoWeekday } from "share";

import { routeTabClassName, RouteTabs } from "@/components/route-tabs";
import { SubjectPosterCard } from "@/components/subject-poster-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useHydrated } from "@/lib/use-hydrated";

interface ScheduleViewProps {
  schedule: ScheduleResponse;
  selectedWeekday: IsoWeekday;
  showAllDaysBeforeHydration?: boolean;
}

export function ScheduleView({
  schedule,
  selectedWeekday,
  showAllDaysBeforeHydration = true,
}: ScheduleViewProps) {
  const hydrated = useHydrated();
  const visibleDays =
    showAllDaysBeforeHydration && !hydrated
      ? schedule.days
      : schedule.days.filter((day) => day.weekday === selectedWeekday);

  return (
    <div className="mt-4">
      <div className="overflow-x-auto pb-1">
        <RouteTabs aria-label="放送日导航">
          {schedule.days.map((day) => (
            <Link
              key={day.weekday}
              to="/schedule/$weekday"
              params={{ weekday: WEEKDAY_SLUG_BY_ISO[day.weekday] }}
              resetScroll={false}
              aria-current={
                day.weekday === selectedWeekday
                  ? showAllDaysBeforeHydration
                    ? "date"
                    : "page"
                  : undefined
              }
              className={routeTabClassName}
            >
              {WEEKDAY_LABELS[day.weekday]}
            </Link>
          ))}
        </RouteTabs>
      </div>

      <div>
        {visibleDays.map((day) => (
          <section
            key={day.weekday}
            aria-labelledby={`weekday-${day.weekday}`}
            data-active={day.weekday === selectedWeekday}
            className="schedule-day mt-8 first:mt-4 data-[active=true]:mt-4"
          >
            <h2 id={`weekday-${day.weekday}`} className="sr-only">
              {WEEKDAY_LABELS[day.weekday]}
            </h2>
            {day.items.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageOff />
                  </EmptyMedia>
                  <EmptyTitle>当天暂无条目</EmptyTitle>
                  <EmptyDescription>可以切换其他星期继续浏览。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
                {day.items.map((item) => (
                  <SubjectPosterCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    imageUrl={item.imageUrl}
                    score={item.score}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
