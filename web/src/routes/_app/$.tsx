import { createFileRoute, notFound } from "@tanstack/react-router";

import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/$")({
  head: () => buildPageHead({ publication: { state: "not-found", reason: "not-found" } }),
  headers: () => ({
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store, max-age=0",
  }),
  loader: () => {
    throw notFound();
  },
  component: () => null,
});
