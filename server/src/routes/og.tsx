import { Hono } from "hono";
import { cache } from "hono/cache";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";
import { bgmUrl, bgmProxy } from "../lib";

const app = new Hono();

const WIDTH = 1200;
const HEIGHT = 630;

const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2-5 5-5-5"/><rect width="20" height="15" x="2" y="7" rx="2"/></svg>';
const ICON_DATA_URI = `data:image/svg+xml;base64,${btoa(ICON_SVG)}`;

const FONT_BASE = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest";
let fontsReady: Promise<ArrayBuffer[]> | null = null;
function loadFonts(): Promise<ArrayBuffer[]> {
  if (!fontsReady) {
    fontsReady = Promise.all([
      fetch(`${FONT_BASE}/chinese-simplified-400-normal.woff`).then((r) => r.arrayBuffer()),
      fetch(`${FONT_BASE}/chinese-simplified-700-normal.woff`).then((r) => r.arrayBuffer()),
    ]);
  }
  return fontsReady;
}

let wasmReady = false;
async function initWasmOnce(): Promise<void> {
  if (wasmReady) return;
  await initWasm(wasmModule);
  wasmReady = true;
}

interface OgData {
  title: string;
  badges: string[];
  score: number | null;
  image: string | null;
}

async function loadOgData(type: string, id: number): Promise<OgData | null> {
  if (type === "subjects") {
    const res = await bgmProxy(bgmUrl(`/v0/subjects/${id}`));
    const s = (await res.json()) as {
      name: string;
      name_cn: string;
      type: number;
      date?: string;
      eps?: number;
      platform?: string;
      images?: { large?: string };
      rating?: { score?: number };
    };
    const badges = [subjectTypeLabel(s.type)];
    if (s.date) badges.push(s.date);
    if (s.eps && s.eps > 0) badges.push(`${s.eps} 话`);
    if (s.platform) badges.push(s.platform);
    return {
      title: s.name_cn || s.name,
      badges,
      score: s.rating?.score && s.rating.score > 0 ? s.rating.score : null,
      image: s.images?.large ?? null,
    };
  }
  if (type === "characters") {
    const res = await bgmProxy(bgmUrl(`/v0/characters/${id}`));
    const c = (await res.json()) as {
      name: string;
      type: number;
      images?: { large?: string };
    };
    return {
      title: c.name,
      badges: [characterTypeLabel(c.type)],
      score: null,
      image: c.images?.large ?? null,
    };
  }
  if (type === "persons") {
    const res = await bgmProxy(bgmUrl(`/v0/persons/${id}`));
    const p = (await res.json()) as {
      name: string;
      career?: string[];
      images?: { large?: string };
    };
    return {
      title: p.name,
      badges: p.career?.length ? p.career.slice(0, 3) : ["人物"],
      score: null,
      image: p.images?.large ?? null,
    };
  }
  return null;
}

function subjectTypeLabel(t: number): string {
  return { 1: "书籍", 2: "动画", 3: "音乐", 4: "游戏", 6: "三次元" }[t] ?? "条目";
}
function characterTypeLabel(t: number): string {
  return { 1: "角色", 2: "机体", 3: "舰船", 4: "组织" }[t] ?? "角色";
}

function titleFontSize(title: string): number {
  const len = [...title].length;
  if (len > 18) return 36;
  if (len > 12) return 44;
  return 52;
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z" />
    </svg>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "40px",
        padding: "0 16px",
        borderRadius: "20px",
        backgroundColor: "rgba(255,255,255,0.08)",
        color: "#d4d4d4",
        fontSize: "22px",
        fontWeight: 400,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

app.get(
  "/:type/:id",
  cache({ cacheName: "og-image", cacheControl: "max-age=86400" }),
  async (c) => {
    const type = c.req.param("type");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.text("Bad id", 400);

    const data = await loadOgData(type, id);
    if (!data) return c.text("Not found", 404);

    const [fonts] = await Promise.all([loadFonts(), initWasmOnce()]);
    const [font400, font700] = fonts;

    let imageData: { base64: string; mime: string } | null = null;
    if (data.image) {
      try {
        const imgRes = await fetch(data.image);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const mime = imgRes.headers.get("content-type") ?? "image/jpeg";
          imageData = { base64: bufToBase64(buf), mime };
        }
      } catch (err) {
        console.warn("og image fetch failed", err);
      }
    }

    const tSize = titleFontSize(data.title);

    const svg = await satori(
      <div
        style={{
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          padding: "60px",
          fontFamily: "Noto Sans SC",
        }}
      >
        <div style={{ display: "flex", gap: "48px", alignItems: "center", flex: "1" }}>
          {imageData ? (
            <img
              src={`data:${imageData.mime};base64,${imageData.base64}`}
              width={300}
              height={400}
              style={{
                borderRadius: "16px",
                objectFit: "cover",
                boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
              }}
            />
          ) : (
            <div
              style={{
                width: "300px",
                height: "400px",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                backgroundColor: "#262626",
              }}
            >
              <div style={{ fontSize: "96px", fontWeight: 700, color: "#525252" }}>B</div>
              <div style={{ fontSize: "20px", color: "#737373" }}>Bangumi X</div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              flex: "1",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: `${tSize}px`,
                fontWeight: 700,
                lineHeight: 1.2,
                color: "#fafafa",
              }}
            >
              {data.title}
            </div>
            {data.score !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Star size={32} color="#737373" />
                <span style={{ fontSize: "44px", fontWeight: 700, color: "#fafafa" }}>
                  {data.score.toFixed(1)}
                </span>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {data.badges.map((b) => (
                <Badge key={b}>{b}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img src={ICON_DATA_URI} width={30} height={30} />
            <div style={{ fontSize: "30px", fontWeight: 700, color: "#fafafa" }}>Bangumi X</div>
          </div>
        </div>
      </div>,
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
          { name: "Noto Sans SC", data: font400, weight: 400, style: "normal" as const },
          { name: "Noto Sans SC", data: font700, weight: 700, style: "normal" as const },
        ],
      },
    );

    const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  },
);

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default app;
