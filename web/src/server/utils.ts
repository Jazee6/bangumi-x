const API_URL = process.env.VITE_API_URL ?? "http://localhost:8787";

export async function bgmFetch<T>(
  path: string,
  opts: {
    query?: Record<string, string | number | undefined>;
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const url = new URL(`${API_URL}/bgm${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`bgmFetch ${path} failed: ${res.status}`);
  return (await res.json()) as Promise<T>;
}
