import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { VISITOR_AGENT_HEADER, type ApiErrorResponse } from "share";

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.trim().length > 0
  );
}

export async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    return isApiErrorResponse(body) ? body.message : fallback;
  } catch {
    return fallback;
  }
}

/**
 * During SSR, Server only sees this web runtime, so pass on who the visitor is; it decides from
 * that whether the visit may add public directory entries. Browser requests carry their own UA.
 */
const visitorHeaders = createIsomorphicFn()
  .server((): Record<string, string> => {
    try {
      return { [VISITOR_AGENT_HEADER]: getRequestHeader("user-agent") ?? "" };
    } catch {
      return {};
    }
  })
  .client((): Record<string, string> => ({}));

export async function requestJson<T>(
  url: URL,
  fallbackMessage: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(visitorHeaders())) headers.set(name, value);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new ApiRequestError(response.status, await getApiErrorMessage(response, fallbackMessage));
  }
  return (await response.json()) as T;
}
