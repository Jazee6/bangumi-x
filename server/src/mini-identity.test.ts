import { describe, expect, test } from "vitest";

import {
  detectMiniAvatarMediaType,
  MiniIdentityError,
  normalizeMiniAccountLinkCode,
  normalizeMiniDisplayName,
} from "./mini-identity";

describe("Mini identity profile rules", () => {
  test("normalizes valid display names by trimming surrounding whitespace", () => {
    expect(normalizeMiniDisplayName("  番迹用户  ")).toBe("番迹用户");
  });

  test("counts Unicode code points and rejects control characters", () => {
    expect(normalizeMiniDisplayName("甲乙")).toBe("甲乙");
    expect(() => normalizeMiniDisplayName("甲\n乙")).toThrow(MiniIdentityError);
    expect(() => normalizeMiniDisplayName("甲")).toThrow("显示名需为 2 至 20 个可见字符。");
    expect(() => normalizeMiniDisplayName("甲".repeat(21))).toThrow(
      "显示名需为 2 至 20 个可见字符。",
    );
  });

  test("normalizes human-entered account pairing codes", () => {
    expect(normalizeMiniAccountLinkCode(" k7m4-pq2r ")).toBe("K7M4PQ2R");
    expect(normalizeMiniAccountLinkCode("K7M4 PQ2R")).toBe("K7M4PQ2R");
    expect(normalizeMiniAccountLinkCode("K7M4-OQ2R")).toBeNull();
    expect(normalizeMiniAccountLinkCode("too-short")).toBeNull();
  });

  test("detects JPEG and PNG by file signature instead of declared MIME type", () => {
    expect(detectMiniAvatarMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      detectMiniAvatarMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(detectMiniAvatarMediaType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });
});
