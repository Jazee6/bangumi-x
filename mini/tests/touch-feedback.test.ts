import { expect, test } from "bun:test";

import { vibrateForRecordChange } from "../miniprogram/lib/touch-feedback";

test("record changes request light haptic feedback without surfacing device failures", () => {
  const previousWx = globalThis.wx;
  let intensity = "";
  globalThis.wx = {
    vibrateShort({ type, fail }: { type: string; fail: () => void }) {
      intensity = type;
      fail();
    },
  } as unknown as typeof wx;

  try {
    expect(() => vibrateForRecordChange()).not.toThrow();
    expect(intensity).toBe("light");
  } finally {
    globalThis.wx = previousWx;
  }
});
