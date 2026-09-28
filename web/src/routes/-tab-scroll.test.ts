import { expect, test } from "bun:test";

async function countMatches(path: string, pattern: RegExp) {
  const source = await Bun.file(new URL(path, import.meta.url)).text();
  return source.match(pattern)?.length ?? 0;
}

test("route tab links preserve the current scroll position", async () => {
  const cases = [
    ["./_app/subjects/$subjectId.tsx", 3],
    ["../features/schedule/schedule-view.tsx", 1],
    ["../features/rankings/rankings-view.tsx", 3],
  ] as const;

  for (const [path, expected] of cases) {
    expect(await countMatches(path, /resetScroll=\{false\}/g)).toBe(expected);
  }
});

test("tabs and same-view filters preserve the current scroll position", async () => {
  const cases = [
    ["./_app/characters/$characterId.tsx", 1],
    ["./_app/collections.tsx", 3],
    ["./_app/discover/$type.tsx", 3],
    ["./_app/persons/$personId.tsx", 1],
    ["./_app/progress.tsx", 1],
    ["./_app/rankings/$year/$season.tsx", 1],
    ["./_app/subjects/$subjectId.tsx", 1],
  ] as const;

  for (const [path, expected] of cases) {
    expect(await countMatches(path, /resetScroll: false/g)).toBe(expected);
  }
});
