import { describe, expect, test } from "vitest";

import { parseAllowedPosterUrl } from "./poster";

describe("parseAllowedPosterUrl", () => {
  test("accepts https lain.bgm.tv cover URLs", () => {
    expect(parseAllowedPosterUrl("https://lain.bgm.tv/pic/cover/l/ce/e2/456080_C4q4C.jpg")).toEqual(
      new URL("https://lain.bgm.tv/pic/cover/l/ce/e2/456080_C4q4C.jpg"),
    );
  });

  test("upgrades http poster URLs to https", () => {
    expect(parseAllowedPosterUrl("http://lain.bgm.tv/pic/cover/l/ce/e2/456080_C4q4C.jpg")).toEqual(
      new URL("https://lain.bgm.tv/pic/cover/l/ce/e2/456080_C4q4C.jpg"),
    );
    expect(
      parseAllowedPosterUrl("http://bgmimg.anibt.net/pic/cover/c/ce/e2/456080_C4q4C.jpg"),
    ).toEqual(new URL("https://bgmimg.anibt.net/pic/cover/c/ce/e2/456080_C4q4C.jpg"));
  });

  test("accepts exact character and person image paths", () => {
    expect(parseAllowedPosterUrl("https://lain.bgm.tv/pic/crt/l/ab/cd/42_crt.jpg")).toEqual(
      new URL("https://lain.bgm.tv/pic/crt/l/ab/cd/42_crt.jpg"),
    );
    expect(parseAllowedPosterUrl("https://lain.bgm.tv/r/400/pic/crt/l/ab/cd/42_prsn.jpg")).toEqual(
      new URL("https://lain.bgm.tv/r/400/pic/crt/l/ab/cd/42_prsn.jpg"),
    );
  });

  test("rejects other hosts, protocols, and paths", () => {
    expect(parseAllowedPosterUrl("https://example.com/pic/cover/l/cover.jpg")).toBeNull();
    expect(parseAllowedPosterUrl("https://lain.bgm.tv/avatar/cover.jpg")).toBeNull();
    expect(parseAllowedPosterUrl("https://lain.bgm.tv/pic/icon/42.jpg")).toBeNull();
    expect(parseAllowedPosterUrl("https://lain.bgm.tv/pic/crt-evil/42.jpg")).toBeNull();
    expect(parseAllowedPosterUrl("https://lain.bgm.tv/r/x/pic/crt/l/42.jpg")).toBeNull();
    expect(parseAllowedPosterUrl("ftp://lain.bgm.tv/pic/cover/l/cover.jpg")).toBeNull();
    expect(parseAllowedPosterUrl("not a url")).toBeNull();
    expect(parseAllowedPosterUrl(123)).toBeNull();
  });
});
