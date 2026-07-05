# OG 图：server 包动态生成（Satori + resvg-wasm）

社交分享预览图由 server 包（Cloudflare Worker）路由 `/og/<type>/<id>` 动态生成，用 Satori 把条目封面 + 标题 + 评分拼成 SVG，再用 @resvg/resvg-wasm（WASM 版，非 native）转 PNG。web 包 `og:image` 指向 `https://s.bgmx.jaze.top/og/<type>/<id>`。

最初尝试在 web 包（EdgeOne Edge Function）用 @resvg/resvg-js（native 版），但 EdgeOne 构建时报 `No loader is configured for .node files`，无法部署原生二进制。改为放在 server 包并使用 WASM 版规避此限制。
