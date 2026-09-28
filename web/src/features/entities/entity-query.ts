import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

export const ENTITY_STALE_TIME = 60 * 60 * 1000;

export function getEntityJson<T>(path: string, fallbackMessage: string): Promise<T> {
  return requestJson<T>(new URL(path, serverUrl), fallbackMessage);
}
