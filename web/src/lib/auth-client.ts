import { createAuthClient } from "better-auth/react";

import { isAllowedAuthReturnPath } from "share";

import { serverUrl } from "@/lib/server-url";
import { useHydrated } from "@/lib/use-hydrated";

export const authClient = createAuthClient({
  baseURL: serverUrl,
  fetchOptions: { credentials: "include" },
});

export function useHydratedSession() {
  const session = authClient.useSession();
  const hydrated = useHydrated();

  return hydrated ? session : { ...session, data: null, isPending: true };
}

export function safeReturnTarget(value: string) {
  if (typeof window === "undefined") return "/";
  try {
    const target = new URL(value, window.location.origin);
    if (target.origin === window.location.origin && isAllowedAuthReturnPath(target.pathname)) {
      return `${target.pathname}${target.search}`;
    }
  } catch {
    // Fall through to the safe home route.
  }
  return "/";
}

export async function beginLogin(returnTo: string) {
  if (typeof window === "undefined") return;
  const callbackURL = new URL(safeReturnTarget(returnTo), window.location.origin).toString();
  const errorCallbackURL = new URL("/?authError=login", window.location.origin).toString();
  const result = await authClient.signIn.social({
    provider: "easy-auth",
    callbackURL,
    errorCallbackURL,
  });
  if (result.error) throw new Error("登录暂时无法完成，请重试。");
}
