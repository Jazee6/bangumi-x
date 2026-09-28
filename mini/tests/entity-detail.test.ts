import { describe, expect, test } from "bun:test";

import type { CharacterDetail, PersonDetail } from "share";

import { getEntityBadges, getEntityTabs } from "../miniprogram/lib/entity-detail";

describe("entity detail pages", () => {
  test("relate characters to persons and persons to characters", () => {
    expect(getEntityTabs("character")[1]).toEqual({
      label: "人物",
      value: "persons",
    });
    expect(getEntityTabs("person")[1]).toEqual({
      label: "角色",
      value: "characters",
    });
  });

  test("lists careers only for persons and skips missing fields", () => {
    const character = {
      type: "角色",
      gender: "女",
      birthday: null,
      bloodType: null,
    } as unknown as CharacterDetail;
    const person = {
      type: "个人",
      careers: ["声优", "歌手"],
      gender: null,
      birthday: "1990-01-01",
      bloodType: "A",
    } as unknown as PersonDetail;
    expect(getEntityBadges(character).map((badge) => badge.value)).toEqual(["角色", "女"]);
    expect(getEntityBadges(person).map((badge) => badge.value)).toEqual([
      "个人",
      "声优、歌手",
      "1990-01-01",
      "A",
    ]);
  });
});
