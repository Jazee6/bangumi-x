import type { MiniContentPolicy } from "share";

import type { AnonymousApp } from "./kit";

// 增删条目后推送到 main 即生效；小程序在五分钟内取到新名单。
const MINI_BLOCKED_SUBJECT_IDS = [630160];
const CONTENT_POLICY_CACHE_CONTROL = "public, max-age=300";

export function registerMiniContentPolicyRoutes(app: AnonymousApp) {
  app.get("/mini/content-policy", (context) => {
    context.header("Cache-Control", CONTENT_POLICY_CACHE_CONTROL);
    return context.json({
      blockedSubjectIds: MINI_BLOCKED_SUBJECT_IDS,
    } satisfies MiniContentPolicy);
  });
}
