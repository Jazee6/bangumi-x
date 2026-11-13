import { expect, test } from "bun:test";

import { PROGRESS_STAGE_VALUES, isAllowedAuthReturnPath } from "./index";

test("progress stage values define in_progress, completed and dropped", () => {
  expect(PROGRESS_STAGE_VALUES).toEqual(["in_progress", "completed", "dropped"]);
});

test("auth return path allows progress route", () => {
  expect(isAllowedAuthReturnPath("/progress")).toBe(true);
  expect(isAllowedAuthReturnPath("/collections")).toBe(true);
  expect(isAllowedAuthReturnPath("/")).toBe(true);
  expect(isAllowedAuthReturnPath("/unknown")).toBe(false);
});
