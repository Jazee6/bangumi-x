import { CANONICAL_WEB_ORIGIN } from "share";

/**
 * Centrally maintained crawler definitions with authoritative source documentation.
 *
 * Architecture policy:
 * 1. Traditional search engines are allowed to crawl public content for web discovery.
 * 2. AI answer/search engines and user-initiated live retrieval (GEO/RAG citation) are allowed.
 * 3. Foundational model training crawlers are strictly disallowed from scraping for LLM pre-training.
 * 4. Robots.txt does NOT disallow pages requiring noindex metadata (such as /collections or /progress),
 *    preventing naked ghost URL indexation in search engines (RFC 9309 / Google Search Central guidelines).
 */

export interface CrawlerDefinition {
  name: string;
  category: "search" | "ai_search" | "ai_training";
  allow: boolean;
  sourceUrl: string;
  notes: string;
}

export const CRAWLER_DEFINITIONS: readonly CrawlerDefinition[] = [
  // Traditional Search Engines
  {
    name: "Googlebot",
    category: "search",
    allow: true,
    sourceUrl:
      "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
    notes: "Google search indexing crawler for web content.",
  },
  {
    name: "Bingbot",
    category: "search",
    allow: true,
    sourceUrl: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
    notes: "Microsoft Bing search indexing crawler.",
  },
  {
    name: "Baiduspider",
    category: "search",
    allow: true,
    sourceUrl: "https://ziyuan.baidu.com/college/courseinfo?id=267&page=2",
    notes: "Baidu search engine web crawler.",
  },
  {
    name: "YandexBot",
    category: "search",
    allow: true,
    sourceUrl: "https://yandex.com/support/webmaster/robot-workings/check-yandex-crawlers.html",
    notes: "Yandex search indexing crawler.",
  },
  {
    name: "Applebot",
    category: "search",
    allow: true,
    sourceUrl: "https://support.apple.com/en-us/119829",
    notes: "Apple search and Siri web crawler.",
  },

  // AI Search & User RAG / Citations (Allowed for generative engine optimization / fact citations)
  {
    name: "OAI-SearchBot",
    category: "ai_search",
    allow: true,
    sourceUrl: "https://platform.openai.com/docs/bots",
    notes: "OpenAI search crawler for ChatGPT Search citations; does not train AI models.",
  },
  {
    name: "ChatGPT-User",
    category: "ai_search",
    allow: true,
    sourceUrl: "https://platform.openai.com/docs/bots",
    notes: "Direct user action requests from ChatGPT browsing features.",
  },
  {
    name: "PerplexityBot",
    category: "ai_search",
    allow: true,
    sourceUrl: "https://docs.perplexity.ai/guides/perplexitybot",
    notes: "Perplexity search crawler for real-time citations in answers.",
  },

  // AI Model Training Crawlers (Disallowed from harvesting data to train models)
  {
    name: "GPTBot",
    category: "ai_training",
    allow: false,
    sourceUrl: "https://platform.openai.com/docs/bots",
    notes: "OpenAI crawler used to collect training datasets for foundation models.",
  },
  {
    name: "ClaudeBot",
    category: "ai_training",
    allow: false,
    sourceUrl:
      "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-it",
    notes: "Anthropic crawler used for Claude model training.",
  },
  {
    name: "Google-Extended",
    category: "ai_training",
    allow: false,
    sourceUrl:
      "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers#google-extended",
    notes:
      "Controls training data collection for Gemini and Vertex AI without affecting Google Search.",
  },
  {
    name: "CCBot",
    category: "ai_training",
    allow: false,
    sourceUrl: "https://commoncrawl.org/ccbot",
    notes: "Common Crawl bot used widely in pre-training large language models.",
  },
  {
    name: "Bytespider",
    category: "ai_training",
    allow: false,
    sourceUrl: "https://www.volcengine.com/docs/6738/107567",
    notes: "ByteDance crawler used for AI and search dataset training.",
  },
  {
    name: "cohere-ai",
    category: "ai_training",
    allow: false,
    sourceUrl: "https://docs.cohere.com/",
    notes: "Cohere AI training data crawler.",
  },
  {
    name: "Diffbot",
    category: "ai_training",
    allow: false,
    sourceUrl: "https://docs.diffbot.com/docs/diffbot-crawler",
    notes: "Diffbot machine learning knowledge graph crawler.",
  },
  {
    name: "FacebookBot",
    category: "ai_training",
    allow: false,
    sourceUrl: "https://developers.facebook.com/docs/sharing/webmasters/crawler",
    notes: "Meta AI model training crawler.",
  },
] as const;

export function buildRobotsTxt(): string {
  const lines: string[] = [
    "# ==================================================================",
    "# Bangumi X - robots.txt",
    "# Policy: Allow search engines and real-time AI citation crawlers.",
    "#         Disallow foundation AI model pre-training crawlers.",
    "# ==================================================================",
    "",
    "# --- 1. Traditional Search Engines ---",
  ];

  for (const crawler of CRAWLER_DEFINITIONS.filter((c) => c.category === "search")) {
    lines.push(`User-agent: ${crawler.name}`);
    lines.push(crawler.allow ? "Allow: /" : "Disallow: /");
    lines.push("");
  }

  lines.push("# --- 2. AI Search & Real-time Citation Crawlers (GEO / RAG) ---");
  for (const crawler of CRAWLER_DEFINITIONS.filter((c) => c.category === "ai_search")) {
    lines.push(`# Official source: ${crawler.sourceUrl}`);
    lines.push(`User-agent: ${crawler.name}`);
    lines.push(crawler.allow ? "Allow: /" : "Disallow: /");
    lines.push("");
  }

  lines.push("# --- 3. AI Model Training Crawlers (Disallowed) ---");
  for (const crawler of CRAWLER_DEFINITIONS.filter((c) => c.category === "ai_training")) {
    lines.push(`# Official source: ${crawler.sourceUrl}`);
    lines.push(`User-agent: ${crawler.name}`);
    lines.push(crawler.allow ? "Allow: /" : "Disallow: /");
    lines.push("");
  }

  lines.push("# --- 4. Global Default Rules ---");
  lines.push("# Private routes (/collections, /progress) use meta/header noindex;");
  lines.push("# they are NOT disallowed here to prevent naked ghost URL indexing.");
  lines.push("User-agent: *");
  lines.push("Disallow: /_server/");
  lines.push("Disallow: /api/auth/");
  lines.push("Allow: /");
  lines.push("");
  lines.push(`Sitemap: ${CANONICAL_WEB_ORIGIN}/sitemap.xml`);

  return lines.join("\n");
}
