import { expect, test } from "bun:test";

const fixturePath = new URL("../../test-fixtures/schedule-spacing-repro.tsx", import.meta.url)
  .pathname;

test("keeps the active weekday spacing stable during hydration", () => {
  const result = Bun.spawnSync({
    cmd: [process.execPath, fixturePath],
    cwd: new URL("../../../", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain(
    "active weekday spacing: before hydration=16px, after hydration=16px",
  );
});
