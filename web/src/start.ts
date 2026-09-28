import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { CANONICAL_WEB_ORIGIN } from "share";

const canonicalRedirectMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  const canonicalUrl = new URL(CANONICAL_WEB_ORIGIN);
  const needsHostRedirect = !isLocal && url.host !== canonicalUrl.host;

  const hasDuplicateSlashes = /\/{2,}/.test(url.pathname);

  if (needsHostRedirect || hasDuplicateSlashes) {
    const cleanPath = url.pathname.replace(/\/{2,}/g, "/") || "/";
    const targetUrl = `${CANONICAL_WEB_ORIGIN}${cleanPath}${url.search}`;
    return Response.redirect(targetUrl, 301);
  }

  return next();
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, canonicalRedirectMiddleware],
}));
