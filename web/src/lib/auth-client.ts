import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  fetchOptions: {
    cache: "no-store",
  },
  plugins: [genericOAuthClient()],
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
});

export type User = typeof authClient.$Infer.Session.user;

export const { useSession } = authClient;
