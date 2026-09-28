import { createFileRoute, Outlet } from "@tanstack/react-router";

import { HeaderTitle } from "@/components/app-shell";

export const Route = createFileRoute("/_app/_schedule")({
  component: ScheduleLayout,
});

function ScheduleLayout() {
  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <HeaderTitle className="text-3xl font-semibold tracking-tight">每日放送</HeaderTitle>
      <Outlet />
    </div>
  );
}
