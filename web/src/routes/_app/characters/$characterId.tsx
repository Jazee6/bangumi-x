import { createFileRoute } from "@tanstack/react-router";

import {
  createEntityRouteOptions,
  EntityPage,
  EntityRouteErrorBoundary,
  EntityRouteLoading,
} from "@/features/entities/entity-route";

export const Route = createFileRoute("/_app/characters/$characterId")({
  ...createEntityRouteOptions("character"),
  pendingComponent: EntityRouteLoading,
  errorComponent: CharacterRouteError,
  component: CharacterPage,
});

function CharacterPage() {
  const { characterId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <EntityPage
      kind="character"
      id={characterId}
      tab={tab}
      onTabChange={(nextTab) => void navigate({ search: { tab: nextTab }, resetScroll: false })}
    />
  );
}

function CharacterRouteError({ error }: { error: unknown }) {
  return <EntityRouteErrorBoundary kind="character" error={error} />;
}
