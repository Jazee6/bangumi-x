# Bangumi X

基于番组计划（Bangumi）公开数据的浏览前端。SSR server 部署在国内，通过 Cloudflare Worker 翻墙访问 bgm 上游 API。纯数据浏览，无用户系统（better-auth 已预留）。

## Language

**Subject**:
番组计划中的条目，对应一部动画、漫画、游戏、音乐或三次元作品。有 `name`（原名）和 `name_cn`（中文名）。
_Avoid_: 作品, item

**LegacySubject**:
上游旧版 `/calendar` 接口返回的条目形状，字段名与 `Subject` 不一致（如 `air_date` vs `date`）。领域上仍是 Subject，区分仅为上游 API 版本差异。
_Avoid_: 把它当作独立领域概念

**Episode**:
条目下的章节，有 `type`（本篇/SP/OP/ED/PV/MAD/其他）和 `sort`（序号）。

**Character**:
条目中的虚拟角色（角色/机体/舰船/组织）。通过 `relation`（主角/配角/客串）与条目关联。

**Person**:
现实人物或组织（个人/公司/组合），通过 `staff`（原作/导演/声优等制作职位）与条目关联。
_Avoid_: 把 Person 与 Character 混用

**FictionalCharacter**:
Character 在结构化数据（JSON-LD）中的语义类型，与 Person（现实人物）区分。schema.org 无官方虚构角色类型，使用 `Role`（指向声优 Person）或 `FictionalCharacter`，避免 AI 把「绫波丽」与「林原惠」归为同一实体。

**Calendar**:
每日放送表，按星期分组返回当周开播的条目。使用旧版 API 故 items 类型为 LegacySubject。

**Worker**:
Cloudflare Workers 边缘代理层，职责是翻墙访问上游 bgm API + edge cache + 图片代理 + UA 注入。SSR server 在国内必须经 Worker 访问 bgm。非可选优化层，是硬性依赖。生产域名 `https://s.bgmx.jaze.top`。

## SEO

**SiteURL**:
站点生产域名 `https://bgmx.jaze.top`。canonical / OG / sitemap 等所有需要绝对 URL 的地方以此为 base。
_Avoid_: 硬编码域名散落各处

**OGImage**:
Open Graph 分享预览图。由 server 包（Worker）动态生成，含封面+标题+类型/职业 Badge+评分+品牌字标。web 包 `og:image` 指向 `https://s.bgmx.jaze.top/og/<type>/<id>`。
_Avoid_: 在 web 包用 native resvg-js（EdgeOne 不支持 .node 二进制）

**JSON-LD**:
schema.org 结构化数据，嵌在 `<script type="application/ld+json">`。Subject 用 `TVSeries`/`CreativeWork`，Character/Person 用 `Person`，首页用 `WebSite`+`SearchAction`，列表页用 `ItemList`。

**Sitemap**:
动态 server route `/sitemap.xml`，含静态页 + 当前放送季条目（来自首页 calendar 数据）+ 列表页入口（/subjects、/characters、/persons）。不拉全量条目 ID（bgm API 无此接口）。
_Avoid_: 全量条目 sitemap

**MachineReadableEndpoint**:
web 包 server route `/api/$type/$id`，返回单个实体的 schema.org JSON-LD（与页面 `<script type="application/ld+json">` 同源，复用 `site.ts` 的 jsonLd 构造函数）。供 AI 工具直接拉取，区别于 Worker 的 `/bgm/*`（代理上游原始 JSON）。
