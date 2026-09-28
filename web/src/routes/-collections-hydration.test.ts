import { test } from "bun:test";

const fixturePath = new URL("../test-fixtures/collections-hydration.tsx", import.meta.url).pathname;

test("the collections page has identical server and first-client auth markup", () => {
  const result = Bun.spawnSync({
    cmd: [process.execPath, fixturePath],
    cwd: new URL("../../", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
});
