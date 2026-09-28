# Host Web on EdgeOne Pages

Bangumi X 的 Web 使用 EdgeOne Pages 承载 TanStack Start SSR、公开页面与 SEO 端点，Cloudflare Server 继续独立承载 Bangumi API 适配、认证和 D1 数据。该拆分沿用 Web 的目标边缘平台，并利用 EdgeOne 的页面缓存与无 Cookie 分析能力，代价是仓库必须显式维护 EdgeOne 可复现部署配置，且不能假设 Cloudflare Workers 专有的 Web 运行时能力。
