export interface PageSearch {
  page?: number;
}

export function parsePage(value: unknown): number {
  const page = typeof value === "number" ? value : Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function validatePageSearch(search: Record<string, unknown>): PageSearch {
  return { page: parsePage(search.page) };
}
