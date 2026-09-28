import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import {
  getCurrentYear,
  isFutureSeason,
  RANKINGS_MIN_YEAR,
  type RankingsPage,
  type Season,
} from "share";

import {
  InfiniteScrollFooter,
  type InfiniteScrollState,
} from "@/components/infinite-scroll-footer";
import { CrawlNavigation } from "@/components/crawl-navigation";
import { routeTabClassName, RouteTabs } from "@/components/route-tabs";
import { SubjectPosterCard } from "@/components/subject-poster-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRankingYears } from "@/features/rankings/rankings-search";

const SEASONS: Array<{ value: Season; label: string }> = [
  { value: "winter", label: "冬季（1月）" },
  { value: "spring", label: "春季（4月）" },
  { value: "summer", label: "夏季（7月）" },
  { value: "autumn", label: "秋季（10月）" },
];

export function RankingsControls({
  year,
  season,
  onYearChange,
}: {
  year: number;
  season: Season;
  onYearChange?: (year: number) => void;
}) {
  const currentYear = getCurrentYear();
  const yearItems = getRankingYears(currentYear).map((option) => ({
    value: option.toString(),
    label: `${option} 年`,
  }));

  return (
    <div className="mt-4 flex items-center justify-between gap-3 overflow-x-auto pb-1">
      <RouteTabs aria-label="季度导航">
        {SEASONS.map(({ value, label }) =>
          isFutureSeason(year, value) ? (
            <span
              key={value}
              aria-disabled="true"
              className={`${routeTabClassName} cursor-not-allowed opacity-50`}
            >
              {label}
            </span>
          ) : (
            <Link
              key={value}
              to="/rankings/$year/$season"
              params={{ year: year.toString(), season: value }}
              resetScroll={false}
              aria-current={value === season ? "page" : undefined}
              className={routeTabClassName}
            >
              {label}
            </Link>
          ),
        )}
      </RouteTabs>
      <Select
        items={yearItems}
        value={year.toString()}
        onValueChange={(value) => onYearChange?.(Number(value))}
      >
        <SelectTrigger aria-label="年份" className="shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {yearItems.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CrawlNavigation aria-label="年份导航" className="flex gap-4 text-sm">
        {year > RANKINGS_MIN_YEAR && (
          <Link
            to="/rankings/$year/$season"
            params={{ year: (year - 1).toString(), season }}
            resetScroll={false}
          >
            {year - 1} 年
          </Link>
        )}
        {year < currentYear && !isFutureSeason(year + 1, season) && (
          <Link
            to="/rankings/$year/$season"
            params={{ year: (year + 1).toString(), season }}
            resetScroll={false}
          >
            {year + 1} 年
          </Link>
        )}
      </CrawlNavigation>
    </div>
  );
}

export function RankingsCollection({
  pages,
  state,
}: {
  pages: RankingsPage[];
  state: InfiniteScrollState;
}) {
  const subjects = pages.flatMap((page) => page.data);
  if (subjects.length === 0) {
    return (
      <Empty variant="outline" className="mt-6 min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trophy />
          </EmptyMedia>
          <EmptyTitle>暂无排行榜条目</EmptyTitle>
          <EmptyDescription>可以切换其他年份或季度继续浏览。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {subjects.map((subject) => (
          <SubjectPosterCard
            key={subject.id}
            id={subject.id}
            title={subject.title}
            imageUrl={subject.imageUrl}
            score={subject.score}
            rank={subject.rank}
          />
        ))}
      </div>
      <InfiniteScrollFooter state={state} />
    </div>
  );
}
