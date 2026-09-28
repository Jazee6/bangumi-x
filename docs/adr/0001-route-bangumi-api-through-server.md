# Route Bangumi API access through Server

Bangumi X 的 Web 与 Mini 不直接依赖 Bangumi API，而只消费根目录 `share` 包定义的规范化契约；API 数据和封面图片都经 Cloudflare Server 转换或代理，并由 Hono 缓存中间件缓存。这样把字段可缺省的 Legacy API 和上游资源地址隔离在单一边界内，并让多个客户端共享稳定语义，代价是本地开发和未来部署必须维护独立 Server 的可用性。
