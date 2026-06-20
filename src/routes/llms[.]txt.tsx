import { createFileRoute } from "@tanstack/react-router";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo/site";

/**
 * llms.txt 是面向生成式搜索引擎（ChatGPT、Perplexity、Claude、Google AI Overviews 等）
 * 的站点导航摘要。规范：https://llmstxt.org
 *
 * 这里只输出导航/索引部分（llms.txt），不输出 llms-full.txt。
 */
function buildLlms(): string {
	return `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} 基于 [Bangumi 番组计划](https://bgm.tv) 的开放 API 提供条目检索、章节列表、
角色与人物资料等结构化信息，覆盖动画、漫画、游戏、音乐、三次元剧集等。所有数据归属于
Bangumi 番组计划及其原始贡献者，本站仅作为现代化阅读界面。

## 主要入口

- [每日放送](${SITE_URL}/)：按星期展示当日开播的番剧
- [条目排行](${SITE_URL}/subjects)：按排名浏览动画/漫画/游戏/音乐条目
- [角色搜索](${SITE_URL}/characters)：按关键词查询虚拟角色
- [人物搜索](${SITE_URL}/persons)：按关键词查询声优、制作人、漫画家等

## 详情页地址结构

- 条目（番剧/漫画/游戏/音乐）：${SITE_URL}/subjects/{id}
- 单集章节：${SITE_URL}/episodes/{id}
- 角色：${SITE_URL}/characters/{id}
- 人物：${SITE_URL}/persons/{id}

## 索引

- [Sitemap (XML)](${SITE_URL}/sitemap.xml) - 站点地图
- [robots.txt](${SITE_URL}/robots.txt) - 抓取策略（对所有合规 bot 全量开放）

## 数据来源

- Bangumi 番组计划 API：https://api.bgm.tv
- 项目主页：https://github.com/Jazee6/bangumi-x

## 内容语言

中文（zh-Hans）。条目原始名称可能为日文 / 英文，详情页同时提供 alternateName。
`;
}

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: async () => {
				return new Response(buildLlms(), {
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						"Cache-Control":
							"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
					},
				});
			},
		},
	},
});
