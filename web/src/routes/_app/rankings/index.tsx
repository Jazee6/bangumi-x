import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentSeason, getCurrentYear } from "share";

export const Route = createFileRoute("/_app/rankings/")({
  beforeLoad: () => {
    const now = new Date();
    const year = getCurrentYear(now);
    const season = getCurrentSeason(now);
    throw redirect({
      to: "/rankings/$year/$season",
      params: { year: year.toString(), season },
      statusCode: 307,
    });
  },
  component: () => null,
});
