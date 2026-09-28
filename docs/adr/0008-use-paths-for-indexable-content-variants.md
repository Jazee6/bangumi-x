# Use paths for indexable content variants

Bangumi X 将可独立索引的内容变体编码为路径：排行榜使用 `/rankings/:year/:season`，本年度热门使用 `/discover/:type`，章节详情使用 `/chapters/:id`；查询参数只承载关键词等不进入索引的临时界面状态。这样让 canonical、内链和站点地图共享同一公开 URL 契约，代价是增加文件路由数量；项目仍在 1.0 前重构期，因此不保留旧查询地址或 `/episodes/:id` 的兼容层。
