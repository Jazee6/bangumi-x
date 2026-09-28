import { createFileRoute, Outlet } from "@tanstack/react-router";

import { TrustLayout } from "@/components/trust-layout";

export const Route = createFileRoute("/_trust")({
  component: TrustPageLayout,
});

function TrustPageLayout() {
  return (
    <TrustLayout>
      <Outlet />
    </TrustLayout>
  );
}
