# 动态生成 OG 图（Satori + resvg-js）

社交分享预览图由 web 包 server route `/og/<type>/<id>` 动态生成，用 Satori 把条目封面 + 标题 + 评分拼成 SVG 再转 PNG，而非直接把条目封面图作为 `og:image`。原因：封面图是纯海报，不含标题/评分等上下文，社交平台信息流里缺乏辨识度；动态图能带站点品牌名，提升点击率。

代价是引入 `satori` + `@resvg/resvg-js` 两个依赖，且 resvg-js 含原生二进制，EdgeOne Edge Function 的兼容性需运行时验证。回退方案：若 EdgeOne 不支持原生模块，回退到 Worker 代理的封面图 URL 作为 `og:image`。
