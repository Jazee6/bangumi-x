import { describe, expect, test } from "vitest";

import {
  normalizePersonDetail,
  normalizePersonRelatedCharacters,
  normalizePersonRelatedSubjects,
  normalizeSubjectPersons,
} from "./person";

const workerOrigin = "https://server.example.test";

describe("person normalization", () => {
  test("groups subject persons by stable priority and preserves multi-role persons", () => {
    const result = normalizeSubjectPersons(
      [
        {
          id: 1,
          name: "监督",
          type: 1,
          career: ["producer"],
          relation: "导演",
          eps: "1-12",
          images: { large: "https://lain.bgm.tv/pic/crt/l/aa/bb/1_prsn.jpg" },
        },
        { id: 2, name: "未知", type: 2, career: [], relation: "顾问", eps: "" },
        { id: 1, name: "监督", type: 1, career: ["producer"], relation: "脚本", eps: "3" },
        { id: 3, name: "动画师", type: 3, career: ["artist"], relation: "作画监督", eps: "" },
        { id: 4, name: "音乐家", type: 1, career: ["artist"], relation: "音乐", eps: "" },
        { id: 5, name: "制作社", type: 2, career: ["producer"], relation: "制作", eps: "" },
        { id: 6, name: "其他", type: 1, career: [], relation: " ", eps: "" },
        { id: 2, name: "未知", type: 2, career: [], relation: "顾问", eps: "" },
        { id: 0, name: "非法", type: 1, career: [], relation: "原作", eps: "" },
      ],
      workerOrigin,
    );

    expect(result.total).toBe(6);
    expect(result.groups.map((group) => group.relation)).toEqual([
      "导演",
      "脚本",
      "作画监督",
      "音乐",
      "制作",
      "其他",
      "顾问",
    ]);
    expect(result.groups[6]?.items).toHaveLength(1);
    expect(result.groups[0]?.items[0]).toEqual({
      id: 1,
      name: "监督",
      type: "个人",
      careers: ["制作人"],
      chapters: "1-12",
      imageUrl:
        "https://server.example.test/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcrt%2Fl%2Faa%2Fbb%2F1_prsn.jpg&size=large",
    });
  });

  test("normalizes person detail core fields and safe fallbacks", () => {
    expect(
      normalizePersonDetail(
        {
          id: 7,
          name: " ",
          type: 3,
          career: ["seiyu", "actor", "unknown job"],
          gender: "female",
          blood_type: 3,
          birth_year: 1980,
          birth_mon: 2,
          birth_day: 29,
          summary: "简介",
          images: { medium: "https://lain.bgm.tv/r/400/pic/crt/l/aa/bb/7_prsn.jpg" },
        },
        workerOrigin,
      ),
    ).toEqual({
      id: 7,
      name: "未命名人物",
      type: "组合",
      careers: ["声优", "演员", "unknown job"],
      gender: "女",
      birthday: "1980年2月29日",
      bloodType: "AB型",
      summary: "简介",
      imageUrl:
        "https://server.example.test/images?url=https%3A%2F%2Flain.bgm.tv%2Fr%2F400%2Fpic%2Fcrt%2Fl%2Faa%2Fbb%2F7_prsn.jpg&size=large",
    });
  });

  test("groups related subjects and related characters with navigation context", () => {
    expect(
      normalizePersonRelatedSubjects(
        [
          {
            id: 11,
            type: 2,
            staff: "音乐",
            eps: "ED",
            name: "Original",
            name_cn: "中文",
            image: "https://lain.bgm.tv/pic/cover/l/a/b/11.jpg",
          },
          { id: 12, type: 4, staff: "顾问", eps: "", name: "", name_cn: "" },
        ],
        workerOrigin,
      ),
    ).toEqual({
      total: 2,
      groups: [
        {
          relation: "音乐",
          items: [
            {
              id: 11,
              title: "中文",
              type: "动画",
              relation: "音乐",
              chapters: "ED",
              imageUrl:
                "https://server.example.test/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fl%2Fa%2Fb%2F11.jpg&size=large",
            },
          ],
        },
        {
          relation: "顾问",
          items: [
            {
              id: 12,
              title: "未命名条目",
              type: "游戏",
              relation: "顾问",
              chapters: null,
              imageUrl: null,
            },
          ],
        },
      ],
    });

    const relatedCharacters = normalizePersonRelatedCharacters(
      [
        {
          id: 21,
          name: "机体",
          type: 2,
          subject_id: 11,
          subject_type: 2,
          subject_name: "Original",
          subject_name_cn: "中文",
          staff: "配角",
        },
        {
          id: 22,
          name: "主角",
          type: 1,
          subject_id: 12,
          subject_type: 4,
          subject_name: "Game",
          subject_name_cn: "游戏",
          staff: "主角",
        },
        {
          id: 21,
          name: "机体",
          type: 2,
          subject_id: 13,
          subject_type: 2,
          subject_name: "Second",
          subject_name_cn: "",
          staff: "驾驶员",
        },
        {
          id: 21,
          name: "机体",
          type: 2,
          subject_id: 11,
          subject_type: 2,
          subject_name: "Original",
          subject_name_cn: "中文",
          staff: "配角",
        },
      ],
      workerOrigin,
    );

    expect(relatedCharacters.total).toBe(2);
    expect(relatedCharacters.groups.map((group) => group.relation)).toEqual([
      "主角",
      "配角",
      "驾驶员",
    ]);
    expect(relatedCharacters.groups[1]?.items).toEqual([
      {
        id: 21,
        name: "机体",
        type: "机体",
        relation: "配角",
        imageUrl: null,
        subject: { id: 11, title: "中文", type: "动画" },
      },
    ]);
  });
});
