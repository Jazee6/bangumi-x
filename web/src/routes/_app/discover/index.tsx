import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/discover/")({
  beforeLoad: () => {
    throw redirect({
      to: "/discover/$type",
      params: { type: "anime" },
      search: { tab: "subjects", page: 1 },
      statusCode: 301,
    });
  },
  component: () => null,
});
