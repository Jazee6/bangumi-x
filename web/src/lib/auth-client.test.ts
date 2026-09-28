import { afterAll, expect, test } from "bun:test";

const originalWindow = globalThis.window;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: { origin: "https://web.example.test" } },
});

const { safeReturnTarget } = await import("./auth-client");

afterAll(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
});

test("login return targets stay on allowlisted application routes", () => {
  expect(safeReturnTarget("/collections")).toBe("/collections");
  expect(safeReturnTarget("/subjects/42?collect=true")).toBe("/subjects/42?collect=true");
  expect(safeReturnTarget("https://evil.example/collections")).toBe("/");
  expect(safeReturnTarget("/admin")).toBe("/");
});
