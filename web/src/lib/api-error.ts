import { createIsomorphicFn } from "@tanstack/react-start";
import { SSR_REQUEST_HEADER, type ApiErrorResponse } from "share";

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
 * SSR requests are marked so Server never counts them as visits: a scraper fetching HTML looks
 * the same as a person until the page runs in a browser, which then reports the visit itself.
 */
const ssrHeaders = createIsomorphicFn()
  .server((): Record<string, string> => ({ [SSR_REQUEST_HEADER]: "1" }))
  .client((): Record<string, string> => ({}));

export async function requestJson<T>(
  url: URL,
  fallbackMessage: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(ssrHeaders())) headers.set(name, value);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new ApiRequestError(response.status, await getApiErrorMessage(response, fallbackMessage));
  }
  return (await response.json()) as T;
}
