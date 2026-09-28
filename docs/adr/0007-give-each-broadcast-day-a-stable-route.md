# Give each broadcast day a stable route

Bangumi X 的首页提供一周每日放送概览，并以 `/schedule/:weekday` 为每个放送日提供稳定子路由和真实链接；不使用具体日期或 `calendar` 路径表达这项每周重复的编排。这样既保留首页的主题完整性，也让“周几放送”的搜索意图拥有可抓取入口，代价是首页和七个子路由需要明确的内容去重与 canonical 规则。
