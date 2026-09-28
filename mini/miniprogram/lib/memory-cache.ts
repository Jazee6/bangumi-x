interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

// 按最近使用淘汰，避免搜索词、分页和章节偏移产生的键在整个运行期内持续累积。
export class MemoryCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(private readonly maxEntries = 200) {}

  clear(): void {
    this.entries.clear();
    this.pending.clear();
  }

  get<T>(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= now) return undefined;
    this.entries.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl: number, now = Date.now()): T {
    this.entries.delete(key);
    this.entries.set(key, { expiresAt: now + ttl, value });
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(oldest);
    }
    return value;
  }

  async load<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;

    const request = loader()
      .then((value) => this.set(key, value, ttl))
      .finally(() => {
        if (this.pending.get(key) === request) this.pending.delete(key);
      });
    this.pending.set(key, request);
    return request;
  }
}

export const publicPageCache = new MemoryCache();
