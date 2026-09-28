import { createFileRoute } from "@tanstack/react-router";

import {
  createEntityRouteOptions,
  EntityPage,
  EntityRouteErrorBoundary,
  EntityRouteLoading,
} from "@/features/entities/entity-route";

export const Route = createFileRoute("/_app/persons/$personId")({
  ...createEntityRouteOptions("person"),
  pendingComponent: EntityRouteLoading,
  errorComponent: PersonRouteError,
  component: PersonPage,
});

function PersonPage() {
  const { personId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <EntityPage
      kind="person"
      id={personId}
      tab={tab}
      onTabChange={(nextTab) => void navigate({ search: { tab: nextTab }, resetScroll: false })}
    />
  );
}

function PersonRouteError({ error }: { error: unknown }) {
  return <EntityRouteErrorBoundary kind="person" error={error} />;
}
