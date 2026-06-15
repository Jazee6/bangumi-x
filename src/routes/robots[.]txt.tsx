import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo/site";

/**
 * 全部 Allow（站点是 bangumi 官方/授权镜像，欢迎传统搜索引擎、AI 检索 bot 与
 * AI 训练 bot 抓取）；仅屏蔽内部 API 路径与搜索结果页（避免无限组合参数收录）。
 *
 * 显式列出常见 AI bot 而非只用 `User-agent: *`，是为了在某些 bot
 * 优先匹配特定段时仍命中 Allow，而不是回落到默认。
 */
const AI_BOTS = [
	"GPTBot",
	"OAI-SearchBot",
	"ChatGPT-User",
	"ClaudeBot",
	"Claude-Web",
	"Claude-User",
	"PerplexityBot",
	"Perplexity-User",
	"Google-Extended",
	"Bytespider",
	"Amazonbot",
	"CCBot",
	"meta-externalagent",
	"Applebot-Extended",
];

function buildRobots(): string {
	const lines: string[] = [];

	// 默认（所有 UA）
	lines.push("User-agent: *", "Allow: /", "Disallow: /api/", "");

	// 显式声明 AI bot 友好。
	for (const ua of AI_BOTS) {
		lines.push(`User-agent: ${ua}`, "Allow: /", "Disallow: /api/", "");
	}

	lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`);
	lines.push(`Host: ${SITE_URL.replace(/^https?:\/\//, "")}`);

	return lines.join("\n");
}

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: async () => {
				return new Response(buildRobots(), {
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
