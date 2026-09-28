import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BRAND_OG_CARD,
  OG_TEMPLATE_VERSION,
  renderOgImage,
  type OgCache,
  type OgCard,
} from "../src/og";
import { getProxiedImageUrl } from "../src/poster";

const miniMode = process.argv.includes("--mini");
const outputDirectory = resolve(
  process.cwd(),
  process.argv.find((argument, index) => index > 1 && argument !== "--mini") ??
    (miniMode ? ".wrangler/mini-og-samples" : ".wrangler/og-samples"),
);
const workerOrigin = "https://s.bgmx.jaze.top";
const sourceImages = [
  "https://lain.bgm.tv/pic/cover/l/e5/69/265_Z5Uou.jpg",
  "https://lain.bgm.tv/pic/cover/l/c2/4c/253_jJJj9.jpg",
  "https://lain.bgm.tv/pic/cover/l/a6/66/326_D8wjw.jpg",
].map((url) => getProxiedImageUrl(url, workerOrigin) as string);
const squareImage = getProxiedImageUrl(
  "https://lain.bgm.tv/pic/cover/l/73/d8/285090_sl33r.jpg",
  workerOrigin,
) as string;

const sampleCards: Array<{ name: string; card: OgCard }> = [
  { name: "brand", card: BRAND_OG_CARD },
  {
    name: "schedule",
    card: {
      cacheKey: "sample-schedule",
      title: "每日放送",
      type: "",
      badges: ["星期一"],
      imageUrls: sourceImages,
      mediaLayout: "stack",
    },
  },
  {
    name: "discover",
    card: {
      cacheKey: "sample-discover",
      title: "动画本年度热门",
      type: "发现",
      badges: ["2026 年", "动画"],
      imageUrls: sourceImages,
      mediaLayout: "stack",
    },
  },
  {
    name: "rankings",
    card: {
      cacheKey: "sample-rankings",
      title: "2026 年秋季排行榜",
      type: "排行榜",
      badges: ["2026 年", "秋季", "动画"],
      imageUrls: sourceImages,
      mediaLayout: "stack",
    },
  },
  {
    name: "subject",
    card: {
      cacheKey: "sample-subject",
      title: "新世纪福音战士",
      type: "动画",
      score: 8.9,
      badges: ["TV", "#2", "1995-10-04", "全 26 话"],
      imageUrls: [sourceImages[0]],
    },
  },
  ...(["章节", "角色", "人物"] as const).map((view) => ({
    name: `subject-${view === "章节" ? "chapters" : view === "角色" ? "characters" : "persons"}`,
    card: {
      cacheKey: `sample-subject-${view}`,
      title: "新世纪福音战士",
      type: "动画",
      score: 8.9,
      badges: ["TV", "#2", "1995-10-04", "全 26 话"],
      imageUrls: [sourceImages[0]],
    },
  })),
  {
    name: "chapter",
    card: {
      cacheKey: "sample-chapter",
      title: "世界の中心でアイを叫んだけもの",
      type: "章节",
      context: "新世纪福音战士",
      badges: ["1996-03-27", "23m"],
      imageUrls: [sourceImages[0]],
    },
  },
  {
    name: "character",
    card: {
      cacheKey: "sample-character",
      title: "绫波丽",
      type: "角色",
      badges: ["女", "3月30日"],
      imageUrls: [sourceImages[1]],
    },
  },
  {
    name: "person",
    card: {
      cacheKey: "sample-person",
      title: "庵野秀明",
      type: "个人",
      badges: ["制作人员、声优", "1960年5月22日"],
      imageUrls: [sourceImages[2]],
    },
  },
  {
    name: "collection-list",
    card: {
      cacheKey: "sample-collection-list",
      title: "值得反复重看的动画",
      type: "公开收藏列表",
      context: "由 Jazee 创建",
      badges: ["24 个条目"],
      imageUrls: sourceImages,
      mediaLayout: "stack",
    },
  },
  {
    name: "subject-square-cover",
    card: {
      cacheKey: "sample-subject-square-cover",
      title: "Original Soundtrack",
      type: "音乐",
      score: 8.2,
      badges: ["#128", "2026-06-18"],
      imageUrls: [squareImage],
    },
  },
  {
    name: "subject-nsfw",
    card: {
      cacheKey: "sample-subject-nsfw",
      title: "敏感内容条目",
      type: "动画",
      badges: ["2026-01-01"],
      imageUrls: [sourceImages[0]],
      sensitive: true,
    },
  },
];

if (miniMode) {
  sampleCards.push({
    name: "keyword-search",
    card: {
      cacheKey: "sample-mini-search",
      title: "搜索「少女乐队」",
      type: "发现",
      badges: ["条目"],
    },
  });
  sampleCards.push({
    name: "subject-without-cover",
    card: {
      cacheKey: "sample-subject-without-cover",
      title: "没有封面的条目",
      type: "动画",
      badges: ["无封面"],
    },
  });
}

class MemoryCache implements OgCache {
  private readonly entries = new Map<string, Response>();

  async match(request: Request): Promise<Response | undefined> {
    return this.entries.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response.clone());
  }
}

await mkdir(outputDirectory, { recursive: true });
const cache = new MemoryCache();
const sampleFontText = Array.from(
  new Set(`Bangumi X番迹NSFW${JSON.stringify(sampleCards.map((sample) => sample.card))}`),
).join("");
const gallery: Array<{ name: string; friend: string; timeline: string }> = [];
for (const [index, sample] of sampleCards.entries()) {
  const prefix = `${String(index + 1).padStart(2, "0")}-${sample.name}`;
  if (!miniMode) {
    const result = await renderOgImage(sample.card, {
      fetch: globalThis.fetch,
      cacheOrigin: workerOrigin,
      cache,
      fontText: sampleFontText,
    });
    const outputPath = resolve(outputDirectory, `${prefix}-${OG_TEMPLATE_VERSION}.png`);
    await Bun.write(outputPath, result.bytes);
    console.log(`Wrote ${outputPath}`);
    continue;
  }

  const files = {} as { friend: string; timeline: string };
  for (const format of ["friend", "timeline"] as const) {
    const result = await renderOgImage(sample.card, {
      fetch: globalThis.fetch,
      cacheOrigin: workerOrigin,
      cache,
      fontText: sampleFontText,
      miniFormat: format,
    });
    if (!result.cacheable) throw new Error(`Missing fonts for ${sample.name}: ${format}`);
    const filename = `${prefix}-${format}-${OG_TEMPLATE_VERSION}.png`;
    await Bun.write(resolve(outputDirectory, filename), result.bytes);
    files[format] = filename;
    console.log(`Wrote ${resolve(outputDirectory, filename)}`);
  }
  gallery.push({ name: sample.name, ...files });
}
if (miniMode) {
  const cards = gallery
    .map(
      ({ name, friend, timeline }) =>
        `<section><h2>${name}</h2><div class="pair"><figure><img src="${friend}" alt="${name} 好友分享"><figcaption>好友 · 5:4</figcaption></figure><figure><img src="${timeline}" alt="${name} 朋友圈分享"><figcaption>朋友圈 · 1:1</figcaption></figure></div></section>`,
    )
    .join("\n");
  await Bun.write(
    resolve(outputDirectory, "index.html"),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>番迹 Mini OG 样式预览</title><style>body{font-family:system-ui,sans-serif;max-width:1200px;margin:32px auto;padding:0 16px}section{margin:32px 0;border-top:1px solid #ddd}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}figure{margin:0}img{display:block;width:100%;max-width:500px}figcaption{padding:8px 0}</style><h1>番迹 Mini OG 样式预览</h1>${cards}</html>`,
  );
}
