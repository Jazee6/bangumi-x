import { mock } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ScheduleResponse } from "share";

let hydrated = false;
const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;

mock.module("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));
mock.module("@/lib/use-hydrated", () => ({
  useHydrated: () => hydrated,
}));
mock.module("@/components/route-tabs", () => ({
  RouteTabs: passthrough,
  routeTabClassName: "tab",
}));
mock.module("@/components/subject-poster-card", () => ({
  SubjectPosterCard: () => <div>条目</div>,
}));
mock.module("@/components/ui/empty", () => ({
  Empty: passthrough,
  EmptyDescription: passthrough,
  EmptyHeader: passthrough,
  EmptyMedia: passthrough,
  EmptyTitle: passthrough,
}));
mock.module("lucide-react", () => ({ ImageOff: () => null }));

const { ScheduleView } = await import("@/features/schedule/schedule-view");

const schedule: ScheduleResponse = {
  fetchedAt: "2026-01-01T00:00:00.000Z",
  days: [
    { weekday: 1, items: [] },
    { weekday: 2, items: [] },
  ],
};

function activeMargin(markup: string): number {
  const sections = [
    ...markup.matchAll(/<section[^>]*data-active="(true|false)"[^>]*class="([^"]+)"/g),
  ];
  const activeIndex = sections.findIndex((match) => match[1] === "true");
  if (activeIndex < 0) throw new Error("Active weekday section not found");
  const className = sections[activeIndex]?.[2] ?? "";

  if (className.includes("data-[active=true]:mt-4")) return 16;
  if (activeIndex === 0 && className.includes("first:mt-4")) return 16;
  if (className.split(" ").includes("mt-4")) return 16;
  if (className.split(" ").includes("mt-8")) return 32;
  throw new Error(`Unknown margin classes: ${className}`);
}

hydrated = false;
const serverMarkup = renderToStaticMarkup(
  createElement(ScheduleView, { schedule, selectedWeekday: 2 }),
);
hydrated = true;
const hydratedMarkup = renderToStaticMarkup(
  createElement(ScheduleView, { schedule, selectedWeekday: 2 }),
);

const before = activeMargin(serverMarkup);
const after = activeMargin(hydratedMarkup);
console.log(`active weekday spacing: before hydration=${before}px, after hydration=${after}px`);
if (before !== after) {
  throw new Error(
    `Homepage weekday spacing jumps by ${Math.abs(before - after)}px during hydration`,
  );
}
