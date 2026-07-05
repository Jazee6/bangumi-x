import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, GITHUB_URL } from "@/lib/seo/site.ts";

export const Route = createFileRoute("/llms.txt")({
  headers: () => ({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  }),
  server: {
    handlers: {
      GET: async () => {
        const content = `# Bangumi X

> Bangumi X 是基于番组计划（Bangumi）公开数据的中文浏览前端，提供动画、漫画、游戏、音乐、三次元条目及关联角色、人物的资料浏览。

## 数据来源
- 上游 API：https://api.bgm.tv （番组计划）
- 原始数据归属 bgm.tv，本站仅做前端展示与结构化封装

## 机器可读端点（JSON-LD）
每个端点返回 schema.org 结构化数据（application/ld+json），含 sameAs 指向 bgm.tv 原始页面：

- 条目（动画/漫画/游戏/音乐/三次元）：${SITE_URL}/api/subjects/{id}
- 角色（虚拟角色）：${SITE_URL}/api/characters/{id}
- 人物（声优/制作人/漫画家等现实人物）：${SITE_URL}/api/persons/{id}
- 章节（条目下的剧集）：${SITE_URL}/api/episodes/{id}

## 实体关系
- Subject（条目）通过 actor/character 字段关联声优与登场角色
- Character（角色）通过 performer 字段关联声优 Person
- Episode（章节）通过 partOfTVSeries 关联所属条目

## 站点地图
- ${SITE_URL}/sitemap.xml

## 联系
- 网站：${SITE_URL}
- 源码：${GITHUB_URL}
`;

        return new Response(content, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
