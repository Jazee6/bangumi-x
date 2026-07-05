# GEO 优化策略：JSON-LD 丰度 + 机器可读端点 + llms.txt

为让 ChatGPT/Claude/Perplexity 等 AI 系统准确引用本站内容，在现有 SSR + JSON-LD 基线上做全面 GEO 铺开。决定：

1. **不启用 build-time prerendering**。数据动态（评分/放送表/简介随时变），EdgeOne edge cache + `Cache-Control` 已提供等价性能与爬虫可达性；静态化会冻结动态数据且需 ISR 重生，EdgeOne 对 ISR 支持未知。
2. **JSON-LD 丰度提升**：所有 detail 实体加 `sameAs`（指向 `bgm.tv/subject|character|person/{id}`）；Subject 按精确 SubjectType 映射 `@type`（Anime→TVSeries、Book→Book、Music→MusicAlbum、Game→VideoGame、Real→TVSeries）；Subject 加 `actor`/`character`，Character 加 `performer`，构建跨实体关系网；WebSite 加 `publisher`（Organization + sameAs 指向 GitHub）；detail 页加 `BreadcrumbList`；Subject 加 `genre`/`keywords`（从 tags top-N）；统一过滤假值（空串/0/`0000-00-00`）；`aggregateRating` 门槛 `total >= 10`。
3. **Character 用 `Role`/`FictionalCharacter`**，不再用 `@type: Person`，避免 AI 把虚构角色与现实人物（声优/制作人）归为同一实体。
4. **新增 `/api/$type/$id`**：web 包 server route，返回带关联的完整 JSON-LD（复用 `site.ts` 构造函数 + server functions 并发拉数据），区别于 Worker 的原始 JSON 代理。
5. **新增 `llms.txt`**：作为数据导引（站点简介 + 实体类型 + API 端点 + sitemap），非文档索引。
6. **robots.txt 显式 Allow** GPTBot/OAI-SearchBot/PerplexityBot/ClaudeBot/Google-Extended。
7. **sitemap 仅扩到列表页入口**（/characters、/persons），不拉热门 ID——避免打满 Worker 缓存与 bgm 限流。

被否方案：Worker 侧加 /api/\*（会重复 JSON-LD 构造逻辑）；预渲染当季条目（数据会过期）；拉热门 ID 写 sitemap（成本与限流风险）。
