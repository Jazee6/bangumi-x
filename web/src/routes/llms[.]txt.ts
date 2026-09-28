import { createFileRoute } from "@tanstack/react-router";

import { CANONICAL_WEB_ORIGIN } from "share";
import { CACHE_CONTROL } from "@/lib/seo";

const LLMS_TXT = `# Bangumi X

> Bangumi X 是以“每日放送 + 发现”为中心的可抓取公开知识入口，致力于为动漫爱好者提供可靠、快速且结构化的条目、角色、人物与放送数据浏览体验。

## 核心公开路由与 URL 结构

- 每日放送概览：${CANONICAL_WEB_ORIGIN}/
- 放送日子路由：${CANONICAL_WEB_ORIGIN}/schedule/:weekday
  - 有效星期：monday, tuesday, wednesday, thursday, friday, saturday, sunday
- 本年度热门：${CANONICAL_WEB_ORIGIN}/discover/:type
  - 有效类型：anime, book, game, music, real
- 动画排行榜：${CANONICAL_WEB_ORIGIN}/rankings/:year/:season
  - 年份范围：1980 至当前自然年
  - 季度划分：winter (1-3月), spring (4-6月), summer (7-9月), autumn (10-12月)
- 条目详情与章节关联：${CANONICAL_WEB_ORIGIN}/subjects/:id
  - 角色关联：${CANONICAL_WEB_ORIGIN}/subjects/:id/characters
  - 人物关联：${CANONICAL_WEB_ORIGIN}/subjects/:id/persons
- 章节详情：${CANONICAL_WEB_ORIGIN}/chapters/:id
- 角色详情：${CANONICAL_WEB_ORIGIN}/characters/:id
- 人物详情：${CANONICAL_WEB_ORIGIN}/persons/:id
- 公开收藏列表：${CANONICAL_WEB_ORIGIN}/s/:shareId

## 领域模型说明

- **每日放送**：按星期一至星期日组织的每周动画放送编排。
- **条目 (Subject)**：包含动画、书籍、音乐、游戏、三次元等媒体形式的核心信息实体。
- **章节 (Chapter)**：条目下属的具体话数、单曲或篇章。
- **角色 (Character)**：作品中登场的虚构角色、机体、舰船或组织。
- **人物 (Person)**：现实中的创作者、声优、演员、制作公司或音乐组合。
- **排行榜 (Rankings)**：按开播季度汇聚并依据全站排名排序的高分动画集合。
- **本年度热门 (Annual Popular)**：当前自然年在对应条目类型中具有有效全站排名的热门作品。

## 数据来源与许可

- 条目信息、封面、内容介绍、章节和角色信息均源自 [Bangumi 番组计划](https://bgm.tv/)。
- 数据依据 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 许可协议提供；相关作品版权归各自创作者与权利人所有。
- 本站仅作为公开数据的呈现与检索入口，不建立全量数据库镜像。
- 维护者：Jazee6 (https://github.com/Jazee6)
- 源码仓库：https://github.com/Jazee6/bangumi-x

## 机器发现端点

- 站点地图索引 (Sitemap Index)：${CANONICAL_WEB_ORIGIN}/sitemap.xml

## 访问与使用准则

- 本站公开页面专为人类读者、搜索引擎建库及生成式引擎（AI Search）实时事实引用（GEO / RAG）设计。
- **未授权模型训练抓取**：禁止使用爬虫将本站内容采集用于大语言模型预训练、二次微调或知识蒸馏。
- 请通过上述公开 HTML 页面及标准发现端点获取事实，本站不提供亦不宣传任何非公开的专属机器 API。
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(LLMS_TXT, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": CACHE_CONTROL.directory,
          },
        });
      },
    },
  },
});
