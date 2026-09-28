import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import { NotFoundPage } from "@/components/not-found-page";
import { Toaster } from "@/components/ui/toast";
import { themeInitializationScript } from "@/features/theme/theme";
import { buildPageHead, buildWebSiteJsonLd } from "@/lib/seo";
import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

function isNotFoundMatch(match: { status?: string; error?: unknown; _notFound?: boolean }) {
  return (
    match.status === "notFound" ||
    match._notFound === true ||
    (typeof match.error === "object" &&
      match.error !== null &&
      "isNotFound" in match.error &&
      match.error.isNotFound === true)
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: ({ matches }) => {
    const notFound = matches.some(isNotFoundMatch);
    const page = buildPageHead({
      imagePath: null,
      jsonLd: notFound ? undefined : buildWebSiteJsonLd(),
      publication: notFound
        ? { state: "not-found", reason: "route-not-found" }
        : { state: "index", reason: "site-shell" },
    });

    const googleVerification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;
    const bingVerification = import.meta.env.VITE_BING_SITE_VERIFICATION;
    const baiduVerification = import.meta.env.VITE_BAIDU_SITE_VERIFICATION;

    const verificationMeta = [
      ...(googleVerification
        ? [{ name: "google-site-verification", content: googleVerification }]
        : []),
      ...(bingVerification ? [{ name: "msvalidate.01", content: bingVerification }] : []),
      ...(baiduVerification
        ? [{ name: "baidu-site-verification", content: baiduVerification }]
        : []),
    ];

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "application-name", content: "Bangumi X" },
        { name: "theme-color", content: "#09090b" },
        ...page.meta,
        ...verificationMeta,
      ],
      links: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "stylesheet", href: appCss },
      ],
    };
  },
  headers: ({ matches }) => {
    const isNotFound = matches.some(isNotFoundMatch);
    return isNotFound
      ? { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store, max-age=0" }
      : undefined;
  },
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        <HeadContent />
      </head>
      <body>
        <Toaster />
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
