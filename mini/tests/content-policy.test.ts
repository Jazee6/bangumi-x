import { describe, expect, test } from "bun:test";

import { createContentPolicy } from "../miniprogram/lib/content-policy";

describe("mini content policy", () => {
  const policy = createContentPolicy([630160]);

  test("treats NSFW and blocked subjects as inaccessible", () => {
    expect(policy.isBlockedSubject({ id: 1, nsfw: false })).toBe(false);
    expect(policy.isBlockedSubject({ id: 1, nsfw: true })).toBe(true);
    expect(policy.isBlockedSubject({ id: 630160, nsfw: false })).toBe(true);
  });

  test("drops blocked subjects from lists and empty groups", () => {
    expect(policy.withoutBlockedSubjects([{ id: 630160 }, { id: 2 }])).toEqual([{ id: 2 }]);
    expect(
      policy.withoutBlockedGroups([
        { relation: "主角", items: [{ id: 630160 }] },
        { relation: "配角", items: [{ id: 630160 }, { id: 2 }] },
      ]),
    ).toEqual([{ relation: "配角", items: [{ id: 2 }] }]);
  });
});
