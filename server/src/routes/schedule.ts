import { getBangumiScheduleUrl } from "../bangumi-api";
import { normalizeSchedule } from "../schedule";
import type { AnonymousApp, AnonymousKit } from "./kit";

export function registerScheduleRoutes(app: AnonymousApp, kit: AnonymousKit) {
  const { runtime, loadJson, jsonCache, recordDiscoveries } = kit;

  app.get("/schedule", jsonCache("schedule"), async (context) => {
    const workerOrigin = new URL(context.req.url).origin;
    const schedule = await loadJson(
      context,
      getBangumiScheduleUrl(context.env.BGM_API_URL),
      "BANGUMI_UPSTREAM_ERROR",
      (value) => normalizeSchedule(value, workerOrigin),
    );
    const fetchedAt = runtime.now();
    await recordDiscoveries(
      context.env,
      schedule.days.flatMap((day) =>
        day.items.map((item) => ({
          resourceType: "subject" as const,
          externalId: item.id.toString(),
          discoverySource: "daily_broadcast" as const,
          indexStatus: "pending" as const,
          indexReason: "schedule_unverified",
        })),
      ),
      fetchedAt,
    );
    return context.json({ ...schedule, fetchedAt: fetchedAt.toISOString() });
  });
}
