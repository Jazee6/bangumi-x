import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { NotFoundPage } from "@/components/not-found-page";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
  notFoundComponent: NotFoundPage,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
