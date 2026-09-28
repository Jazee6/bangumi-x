# Host stateful services in Server

Bangumi X 的 Better Auth、会话、Drizzle ORM、Cloudflare D1 与个人数据 API 统一由 Server 承载；Web 只通过 `share` 中的公开契约和带凭据的 HTTP 请求消费这些能力。

这个边界使认证密钥、数据库绑定、用户身份判定和写入事务始终留在可信运行时，也让匿名缓存路由与 `private, no-store` 的有状态路由拥有独立装配。代价是 Web 与 Server 的本地开发必须同时运行，并正确配置精确 CORS origin、OAuth 回调代理和本地 D1。

Web 原有的 Better Auth 服务端路由与 SQLite/Drizzle 占位实现直接删除，不保留兼容层。测试从 Server 的公开 Hono handler 进入，并只在最高应用边界替换认证、时钟、上游请求和 D1-compatible persistence。
