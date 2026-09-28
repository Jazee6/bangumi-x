import type { ApiErrorResponse } from "share";

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

export async function requestJson<T>(
  url: URL,
  fallbackMessage: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiRequestError(response.status, await getApiErrorMessage(response, fallbackMessage));
  }
  return (await response.json()) as T;
}
