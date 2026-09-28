# Expose subject relations through canonical routes

Bangumi X 将章节作为条目详情的默认关联视图，使用 `/subjects/:id` 同时承载条目概览与章节列表；角色与人物继续分别使用 `/subjects/:id/characters` 和 `/subjects/:id/persons`，并以真实链接呈现页内切换。`/subjects/:id/chapters` 不再作为公开路由，也不保留兼容层。

这样既让最常用的章节关系直接出现在条目的规范 URL，又保留角色与人物可独立抓取的页面，并减少重复 canonical、站点地图条目和导航状态；代价是条目首页需要同时加载章节列表。
