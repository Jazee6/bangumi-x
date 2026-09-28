import { describe, expect, test } from "vitest";

import {
  normalizeCharacterDetail,
  normalizeCharacterRelatedPersons,
  normalizeCharacterRelatedSubjects,
  normalizeSubjectCharacters,
} from "./character";

const workerOrigin = "https://server.example.test";

describe("character normalization", () => {
  test("groups every character type, sorts relations, deduplicates, and keeps actors", () => {
    const result = normalizeSubjectCharacters(
      [
        {
          id: 1,
          name: "主角",
          type: 1,
          relation: "主角",
          actors: [{ id: 91, name: "声优", type: 1, career: ["seiyu"] }],
        },
        { id: 2, name: "未知", type: 2, relation: "驾驶员", actors: [] },
        { id: 3, name: "舰船", type: 3, relation: "配角", actors: [] },
        { id: 4, name: "组织", type: 4, relation: "客串", actors: [] },
        { id: 5, name: "其他", type: 1, relation: "", actors: [] },
        { id: 2, name: "未知", type: 2, relation: "驾驶员", actors: [] },
      ],
      workerOrigin,
    );

    expect(result.total).toBe(5);
    expect(result.groups.map((group) => group.relation)).toEqual([
      "主角",
      "配角",
      "客串",
      "其他",
      "驾驶员",
    ]);
    expect(result.groups[0]?.items[0]).toEqual({
      id: 1,
      name: "主角",
      type: "角色",
      imageUrl: null,
      actors: [{ id: 91, name: "声优", type: "个人" }],
    });
    expect(result.groups[4]?.items).toHaveLength(1);
  });

  test("normalizes character detail and partial birthdays", () => {
    expect(
      normalizeCharacterDetail(
        {
          id: 8,
          name: " ",
          type: 4,
          gender: "male",
          blood_type: 4,
          birth_year: null,
          birth_mon: 12,
          birth_day: 5,
          summary: "角色简介",
          images: { large: "https://lain.bgm.tv/pic/crt/l/a/b/8_crt.jpg" },
        },
        workerOrigin,
      ),
    ).toEqual({
      id: 8,
      name: "未命名角色",
      type: "组织",
      gender: "男",
      birthday: "12月5日",
      bloodType: "O型",
      summary: "角色简介",
      imageUrl:
        "https://server.example.test/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcrt%2Fl%2Fa%2Fb%2F8_crt.jpg&size=large",
    });
  });

  test("sorts and deduplicates both character association directions", () => {
    const subjects = normalizeCharacterRelatedSubjects(
      [
        { id: 11, type: 2, staff: "未知", eps: "", name: "Unknown", name_cn: "" },
        { id: 10, type: 1, staff: "主角", eps: "", name: "Book", name_cn: "书" },
        { id: 10, type: 1, staff: "配角", eps: "2", name: "Book", name_cn: "书" },
        { id: 10, type: 1, staff: "主角", eps: "", name: "Book", name_cn: "书" },
      ],
      workerOrigin,
    );

    expect(subjects.total).toBe(2);
    expect(subjects.groups.map((group) => group.relation)).toEqual(["主角", "配角", "未知"]);
    expect(subjects.groups[0]?.items).toEqual([
      {
        id: 10,
        title: "书",
        type: "书籍",
        relation: "主角",
        chapters: null,
        imageUrl: null,
      },
    ]);

    const persons = normalizeCharacterRelatedPersons(
      [
        {
          id: 42,
          name: "演员",
          type: 1,
          subject_id: 10,
          subject_type: 1,
          subject_name: "Book",
          subject_name_cn: "书",
          staff: "配角",
        },
        {
          id: 43,
          name: "主役",
          type: 1,
          subject_id: 11,
          subject_type: 2,
          subject_name: "Anime",
          subject_name_cn: "动画",
          staff: "主角",
        },
        {
          id: 42,
          name: "演员",
          type: 1,
          subject_id: 12,
          subject_type: 4,
          subject_name: "Game",
          subject_name_cn: "游戏",
          staff: "客串",
        },
        {
          id: 42,
          name: "演员",
          type: 1,
          subject_id: 10,
          subject_type: 1,
          subject_name: "Book",
          subject_name_cn: "书",
          staff: "配角",
        },
      ],
      workerOrigin,
    );

    expect(persons.total).toBe(2);
    expect(persons.groups.map((group) => group.relation)).toEqual(["主角", "配角", "客串"]);
    expect(persons.groups[1]?.items).toEqual([
      {
        id: 42,
        name: "演员",
        type: "个人",
        relation: "配角",
        imageUrl: null,
        subject: { id: 10, title: "书", type: "书籍" },
      },
    ]);
  });
});
