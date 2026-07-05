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

**Calendar**:
每日放送表，按星期分组返回当周开播的条目。使用旧版 API 故 items 类型为 LegacySubject。

**Worker**:
Cloudflare Workers 边缘代理层，职责是翻墙访问上游 bgm API + edge cache + 图片代理 + UA 注入。SSR server 在国内必须经 Worker 访问 bgm。非可选优化层，是硬性依赖。
