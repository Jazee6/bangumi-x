import { expect, test } from "vitest";

import rootPackage from "../../package.json";

import { BANGUMI_USER_AGENT } from "./constants";

test("keeps the Bangumi user agent aligned with the project version", () => {
  expect(BANGUMI_USER_AGENT).toBe(`Jazee6/${rootPackage.name}/${rootPackage.version}`);
});
