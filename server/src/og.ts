import { Resvg, initWasm as initResvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import satori, { init as initSatori } from "satori/standalone";
import yogaWasm from "satori/yoga.wasm";

import fallbackFont from "./assets/noto-sans-sc-brand.ttf";
import miniBrandFont from "./assets/noto-sans-sc-mini-brand.ttf";
import { parseProxiedImageSource } from "./poster";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_TEMPLATE_VERSION = "og-v3";
export const OG_CACHE_CONTROL =
  "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";
export const OG_FAILURE_CACHE_CONTROL = "no-cache, no-store, must-revalidate";

const NOTO_FONT_FAMILY = "Noto Sans SC";
const MINI_BRAND_FONT_FAMILY = "Noto Sans SC Mini";
const INTER_FONT_FAMILY = "Inter";
const NOTO_FONT_CACHE_VERSION = "noto-sans-sc-v2";
const INTER_FONT_CACHE_VERSION = "inter-v1";
const MAX_FONT_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 3000;
const ALLOWED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface OgCard {
  cacheKey: string;
  title: string;
  type: string;
  badges: readonly string[];
  imageUrls?: readonly string[];
  mediaLayout?: "single" | "stack";
  context?: string | null;
  score?: number | null;
  sensitive?: boolean;
  brand?: boolean;
}

export interface OgCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete?(request: Request): Promise<boolean>;
}

export interface OgRenderRuntime {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  cacheOrigin: string;
  cache?: OgCache;
  fontText?: string;
  miniFormat?: "friend" | "timeline";
}

export interface OgImageResult {
  bytes: Uint8Array;
  cacheable: boolean;
}

export type OgImageRenderer = (card: OgCard, runtime: OgRenderRuntime) => Promise<OgImageResult>;

export const BRAND_OG_CARD: OgCard = {
  cacheKey: "brand",
  title: "Bangumi X",
  type: "",
  badges: [],
  brand: true,
};

let wasmInitialization: Promise<void> | undefined;

function arrayBufferFromView(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

async function resolveBinaryAsset(
  asset: string | ArrayBuffer | Uint8Array | WebAssembly.Module,
): Promise<ArrayBuffer | WebAssembly.Module> {
  if (asset instanceof WebAssembly.Module || asset instanceof ArrayBuffer) {
    return asset;
  }
  if (asset instanceof Uint8Array) {
    return arrayBufferFromView(asset);
  }
  if (typeof Bun !== "undefined") {
    return Bun.file(asset).arrayBuffer();
  }
  throw new Error("Unsupported bundled binary asset");
}

async function ensureWasmInitialized(): Promise<void> {
  wasmInitialization ??= Promise.all([
    resolveBinaryAsset(yogaWasm).then(initSatori),
    resolveBinaryAsset(resvgWasm).then(initResvg),
  ]).then(() => undefined);
  return wasmInitialization;
}

function pngDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

function boundedText(value: string, maximum: number): string {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  return Array.from(normalized).slice(0, maximum).join("");
}

function normalizeCard(card: OgCard): OgCard {
  const score =
    typeof card.score === "number" && Number.isFinite(card.score) && card.score > 0
      ? card.score
      : null;
  return {
    cacheKey: boundedText(card.cacheKey, 120),
    title: boundedText(card.title, 120),
    type: boundedText(card.type, 48),
    badges: card.badges.slice(0, 6).map((badge) => boundedText(badge, 48)),
    imageUrls: card.sensitive
      ? []
      : card.imageUrls?.slice(0, 3).filter((url) => typeof url === "string" && url.length > 0),
    mediaLayout: card.mediaLayout ?? "single",
    context: card.context ? boundedText(card.context, 80) : null,
    score,
    sensitive: card.sensitive === true,
    brand: card.brand === true,
  };
}

function uniqueFontText(card: OgCard): string {
  return Array.from(
    new Set(
      [
        "Bangumi X",
        "NSFW",
        card.title,
        card.type,
        card.context ?? "",
        card.score?.toFixed(1) ?? "",
        ...card.badges,
      ].join(""),
    ),
  ).join("");
}

function latinFontText(card: OgCard): string {
  const text = uniqueFontText(card);
  const latin = Array.from(text)
    .filter((character) => (character.codePointAt(0) ?? 0) <= 0x024f)
    .join("");
  return latin || "Bangumi X 0123456789";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function fontCacheRequest(version: string, text: string, cacheOrigin: string): Request {
  const url = new URL(`/__og-font-cache/${version}/${stableHash(text)}`, cacheOrigin);
  return new Request(url);
}

function parseGoogleFontUrl(css: string): URL | null {
  const match = css.match(
    /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\(['"](?:truetype|woff)['"]\)/,
  );
  if (!match?.[1]) return null;
  try {
    return new URL(match[1]);
  } catch {
    return null;
  }
}

async function loadGoogleFont(
  family: string,
  cacheVersion: string,
  text: string,
  runtime: OgRenderRuntime,
): Promise<ArrayBuffer> {
  const cacheRequest = fontCacheRequest(cacheVersion, text, runtime.cacheOrigin);
  const cached = await runtime.cache?.match(cacheRequest);
  if (cached?.ok) {
    return cached.arrayBuffer();
  }

  const cssUrl = new URL("https://fonts.googleapis.com/css2");
  cssUrl.searchParams.set("family", `${family}:wght@700`);
  cssUrl.searchParams.set("text", text);
  const cssResponse = await runtime.fetch(cssUrl, {
    headers: { "User-Agent": "curl/8.0" },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!cssResponse.ok) throw new Error("Google Fonts stylesheet unavailable");

  const fontUrl = parseGoogleFontUrl(await cssResponse.text());
  if (!fontUrl) throw new Error("Google Fonts returned no supported font");
  const fontResponse = await runtime.fetch(fontUrl, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!fontResponse.ok) throw new Error("Google font unavailable");
  const font = await fontResponse.arrayBuffer();
  if (font.byteLength === 0 || font.byteLength > MAX_FONT_BYTES) {
    throw new Error("Google font size is invalid");
  }

  await runtime.cache?.put(
    cacheRequest,
    new Response(font.slice(0), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "font/ttf",
      },
    }),
  );
  return font;
}

async function loadFallbackFont(): Promise<ArrayBuffer> {
  const asset = await resolveBinaryAsset(fallbackFont);
  if (asset instanceof WebAssembly.Module) {
    throw new Error("Fallback font was bundled as WebAssembly");
  }
  return asset;
}

function bytesToDataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function loadCoverDataUrl(
  imageUrl: string | null | undefined,
  runtime: OgRenderRuntime,
): Promise<string | null> {
  if (!imageUrl) return null;

  const upstreamUrl = parseProxiedImageSource(imageUrl);
  if (!upstreamUrl) return null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await runtime.fetch(upstreamUrl, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("Content-Type")?.split(";", 1)[0]?.toLowerCase();
      if (!contentType || !ALLOWED_COVER_TYPES.has(contentType)) return null;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_COVER_BYTES) return null;
      return bytesToDataUrl(new Uint8Array(buffer), contentType);
    } catch {
      // Retry once for transient cover-host or timeout failures.
    }
  }

  return null;
}

function tvIcon(size: number) {
  return {
    type: "svg",
    props: {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fafafa",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        { type: "path", props: { d: "m17 2-5 5-5-5" } },
        { type: "rect", props: { width: 20, height: 15, x: 2, y: 7, rx: 2 } },
      ],
    },
  };
}

function starIcon(size: number) {
  return {
    type: "svg",
    props: {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "#fafafa",
      children: [
        {
          type: "path",
          props: {
            d: "M12 2.6 14.9 8.5 21.4 9.4 16.7 14 17.8 20.5 12 17.4 6.2 20.5 7.3 14 2.6 9.4 9.1 8.5Z",
          },
        },
      ],
    },
  };
}

function imageFrame(src: string, width: number, height: number, transform?: string) {
  return {
    type: "div",
    props: {
      style: {
        width,
        height,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.10)",
        backgroundColor: "#27272a",
        boxShadow: "0 24px 60px rgba(0,0,0,0.38)",
        ...(transform ? { transform } : {}),
      },
      children: [
        {
          type: "img",
          props: {
            src,
            width,
            height,
            style: {
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              objectFit: "cover",
              filter: "blur(18px) saturate(1.35)",
              transform: "scale(1.16)",
              opacity: 0.72,
            },
          },
        },
        {
          type: "img",
          props: {
            src,
            width,
            height,
            style: {
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              objectFit: "contain",
            },
          },
        },
      ],
    },
  };
}

function singleMedia(src: string) {
  return {
    type: "div",
    props: {
      style: { width: 340, height: 510, display: "flex", flexShrink: 0 },
      children: imageFrame(src, 340, 510),
    },
  };
}

function stackedMedia(sources: readonly string[]) {
  const positions = [
    { left: 0, top: 25, transform: "rotate(-4deg)" },
    { left: 55, top: 45, transform: "rotate(1deg)" },
    { left: 110, top: 65, transform: "rotate(6deg)" },
  ];
  const frames = sources.slice(0, 3).map((src, index) => {
    const position = positions[index] ?? positions[0];
    return {
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: position.left,
          top: position.top,
          width: 280,
          height: 420,
          display: "flex",
        },
        children: imageFrame(src, 280, 420, position.transform),
      },
    };
  });

  return {
    type: "div",
    props: {
      style: { width: 405, height: 510, display: "flex", position: "relative", flexShrink: 0 },
      children: frames.reverse(),
    },
  };
}

function badge(text: string, destructive = false) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        marginRight: 10,
        marginBottom: 10,
        padding: "9px 15px",
        borderRadius: 999,
        border: destructive
          ? "1px solid rgba(251,113,133,0.40)"
          : "1px solid rgba(255,255,255,0.10)",
        backgroundColor: destructive ? "rgba(127,29,29,0.72)" : "#27272a",
        color: destructive ? "#fecdd3" : "#fafafa",
        fontSize: 20,
        lineHeight: 1,
      },
      children: text,
    },
  };
}

function brandSignature(name = "Bangumi X") {
  return {
    type: "div",
    props: {
      style: { display: "flex", alignItems: "center", color: "#fafafa", fontSize: 23 },
      children: [
        tvIcon(30),
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              marginLeft: 12,
              ...(name === "番迹" ? { fontFamily: MINI_BRAND_FONT_FAMILY } : {}),
            },
            children: name,
          },
        },
      ],
    },
  };
}

function titleFontSize(title: string, hasMedia: boolean): number {
  const length = Array.from(title).length;
  if (length <= 14) return hasMedia ? 58 : 66;
  if (length <= 26) return hasMedia ? 50 : 58;
  return hasMedia ? 42 : 48;
}

function brandElement(fontFamily: string, name = "Bangumi X") {
  return {
    type: "div",
    props: {
      lang: "zh-CN",
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        color: "#fafafa",
        backgroundColor: "#09090b",
        backgroundImage:
          "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.09), transparent 34%), radial-gradient(circle at 80% 85%, rgba(255,255,255,0.05), transparent 32%)",
        fontFamily,
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center" },
            children: [
              tvIcon(88),
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    marginLeft: 28,
                    fontSize: 76,
                    fontWeight: 700,
                    letterSpacing: "-3px",
                    ...(name === "番迹" ? { fontFamily: MINI_BRAND_FONT_FAMILY } : {}),
                  },
                  children: name,
                },
              },
            ],
          },
        },
      ],
    },
  } as Parameters<typeof satori>[0];
}

function cardElement(
  card: OgCard,
  coverDataUrls: readonly string[],
  fontFamily: string,
  name = "Bangumi X",
) {
  if (card.brand) return brandElement(fontFamily, name);

  const covers = coverDataUrls.filter((url) => url.length > 0).slice(0, 3);
  const media =
    covers.length === 0
      ? null
      : card.mediaLayout === "stack"
        ? stackedMedia(covers)
        : singleMedia(covers[0] ?? "");
  const hasMedia = media !== null;
  const background = covers[0]
    ? {
        type: "img",
        props: {
          src: covers[0],
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          style: {
            position: "absolute",
            left: 0,
            top: 0,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            objectFit: "cover",
            filter: "blur(20px) saturate(1.8)",
            transform: "scale(1.15)",
            opacity: 0.72,
          },
        },
      }
    : null;
  const badges = [
    ...(card.sensitive ? [badge("NSFW", true)] : []),
    ...card.badges.map((item) => badge(item)),
  ];

  return {
    type: "div",
    props: {
      lang: "zh-CN",
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        color: "#fafafa",
        backgroundColor: "#09090b",
        ...(covers.length
          ? {}
          : {
              backgroundImage:
                "radial-gradient(circle at 24% 18%, rgba(255,255,255,0.08), transparent 34%), radial-gradient(circle at 82% 82%, rgba(255,255,255,0.04), transparent 34%)",
            }),
        fontFamily,
      },
      children: [
        ...(background
          ? [
              background,
              {
                type: "div",
                props: {
                  style: {
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    display: "flex",
                    backgroundColor: "rgba(9,9,11,0.80)",
                  },
                },
              },
            ]
          : []),
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              left: 60,
              top: 60,
              width: OG_IMAGE_WIDTH - 120,
              height: OG_IMAGE_HEIGHT - 120,
              display: "flex",
            },
            children: [
              media,
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flex: 1,
                    minWidth: 0,
                    flexDirection: "column",
                    justifyContent: "space-between",
                    paddingLeft: hasMedia ? 46 : 0,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flexDirection: "column", minWidth: 0 },
                        children: [
                          card.type
                            ? {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    color: "#a1a1aa",
                                    fontSize: 24,
                                    fontWeight: 700,
                                  },
                                  children: card.type,
                                },
                              }
                            : null,
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "block",
                                marginTop: card.type ? 20 : 0,
                                fontSize: titleFontSize(card.title, hasMedia),
                                fontWeight: 700,
                                lineHeight: 1.12,
                                letterSpacing: "-1.5px",
                                lineClamp: 2,
                              },
                              children: card.title,
                            },
                          },
                          card.context
                            ? {
                                type: "div",
                                props: {
                                  style: {
                                    display: "block",
                                    marginTop: 18,
                                    color: "#a1a1aa",
                                    fontSize: 22,
                                    lineClamp: 1,
                                  },
                                  children: card.context,
                                },
                              }
                            : null,
                          card.score
                            ? {
                                type: "div",
                                props: {
                                  style: { display: "flex", alignItems: "center", marginTop: 22 },
                                  children: [
                                    starIcon(31),
                                    {
                                      type: "div",
                                      props: {
                                        style: {
                                          display: "flex",
                                          marginLeft: 12,
                                          fontSize: 38,
                                          fontWeight: 700,
                                          lineHeight: 1,
                                        },
                                        children: card.score.toFixed(1),
                                      },
                                    },
                                  ],
                                },
                              }
                            : null,
                          badges.length > 0
                            ? {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    flexWrap: "wrap",
                                    marginTop: card.score || card.context ? 18 : 26,
                                  },
                                  children: badges,
                                },
                              }
                            : null,
                        ],
                      },
                    },
                    brandSignature(name),
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  } as Parameters<typeof satori>[0];
}

export const renderOgImage: OgImageRenderer = async (inputCard, runtime) => {
  await ensureWasmInitialized();

  let card = normalizeCard(inputCard);
  let cacheable = true;
  let notoFont: ArrayBuffer;
  try {
    const fontText = runtime.fontText
      ? boundedText(runtime.fontText, 2_000)
      : `${uniqueFontText(card)}${runtime.miniFormat ? "番迹" : ""}`;
    notoFont = await loadGoogleFont(NOTO_FONT_FAMILY, NOTO_FONT_CACHE_VERSION, fontText, runtime);
  } catch {
    if (card.cacheKey !== BRAND_OG_CARD.cacheKey) {
      card = BRAND_OG_CARD;
      cacheable = false;
    }
    notoFont = await loadFallbackFont();
  }

  const interFont = await loadGoogleFont(
    INTER_FONT_FAMILY,
    INTER_FONT_CACHE_VERSION,
    runtime.fontText
      ? Array.from(runtime.fontText)
          .filter((character) => (character.codePointAt(0) ?? 0) <= 0x024f)
          .join("")
      : latinFontText(card),
    runtime,
  ).catch(() => null);
  const coverDataUrls = (
    await Promise.all((card.imageUrls ?? []).map((imageUrl) => loadCoverDataUrl(imageUrl, runtime)))
  ).filter((imageUrl): imageUrl is string => imageUrl !== null);
  const fontFamily = interFont ? `${INTER_FONT_FAMILY}, ${NOTO_FONT_FAMILY}` : NOTO_FONT_FAMILY;
  const fonts: Parameters<typeof satori>[1]["fonts"] = [
    { name: NOTO_FONT_FAMILY, data: notoFont, weight: 700, style: "normal" },
  ];
  if (interFont) {
    fonts.unshift({ name: INTER_FONT_FAMILY, data: interFont, weight: 700, style: "normal" });
  }
  if (runtime.miniFormat) {
    fonts.push({
      name: MINI_BRAND_FONT_FAMILY,
      data: (await resolveBinaryAsset(miniBrandFont)) as ArrayBuffer,
      weight: 700,
      style: "normal",
    });
  }

  const miniFormat = runtime.miniFormat;
  const name = miniFormat ? "番迹" : "Bangumi X";
  const cardSvg = await satori(cardElement(card, coverDataUrls, fontFamily, name), {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  });
  const size = miniFormat === "friend" ? { width: 1000, height: 800 } : { width: 800, height: 800 };
  const baseImage = miniFormat ? new Resvg(cardSvg, { font: { loadSystemFonts: false } }) : null;
  let basePng: Uint8Array | null = null;
  if (baseImage) {
    const renderedBase = baseImage.render();
    try {
      basePng = new Uint8Array(renderedBase.asPng());
    } finally {
      renderedBase.free();
      baseImage.free();
    }
  }
  const svg = basePng
    ? await satori(
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              backgroundColor: "#09090b",
            },
            children: {
              type: "img",
              props: {
                src: pngDataUrl(basePng),
                width: size.width,
                height: Math.round((size.width * OG_IMAGE_HEIGHT) / OG_IMAGE_WIDTH),
              },
            },
          },
        } as Parameters<typeof satori>[0],
        { ...size, fonts },
      )
    : cardSvg;
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: false },
  });
  const rendered = renderer.render();
  try {
    return { bytes: new Uint8Array(rendered.asPng()), cacheable };
  } finally {
    rendered.free();
    renderer.free();
  }
};

export function getDefaultOgCache(): OgCache | undefined {
  const workerCaches = globalThis.caches as unknown as { default?: OgCache } | undefined;
  return workerCaches?.default;
}

export function createOgCacheRequest(requestUrl: string, cacheKey: string): Request {
  const source = new URL(requestUrl);
  const cacheUrl = new URL(
    `/__og-cache/${OG_TEMPLATE_VERSION}/${encodeURIComponent(cacheKey)}`,
    source.origin,
  );
  return new Request(cacheUrl);
}
