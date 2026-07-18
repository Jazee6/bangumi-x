# Worker-owned authentication

Bangumi X authentication is owned by the Cloudflare Worker at `s.bgmx.jaze.top`, backed by an application-specific D1 database, rather than by the Web SSR server or WebChat's database. Authentication is optional for public browsing, so the Web client reads the session after hydration and the host-only auth cookie remains scoped to the API host; this keeps session validation and persistence at one boundary without forwarding credentials through SSR or exposing them to the Web host.
