import { describe, expect, test } from "vitest";

import { ApiError } from "./api-error";

describe("ApiError retry semantics", () => {
  test("uses status defaults unless the domain supplies an explicit retry decision", () => {
    expect(
      new ApiError(409, {
        code: "MINI_ACCOUNT_LINK_CHANGED",
        message: "changed",
        retryable: true,
      }).toResponse().retryable,
    ).toBe(true);
    expect(
      new ApiError(503, {
        code: "MINI_AUTH_UNAVAILABLE",
        message: "unavailable",
        retryable: false,
      }).toResponse().retryable,
    ).toBe(false);
    expect(
      new ApiError(503, { code: "MINI_AUTH_UNAVAILABLE", message: "unavailable" }).toResponse()
        .retryable,
    ).toBe(true);
  });
});
