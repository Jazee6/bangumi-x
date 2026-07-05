import { Hono } from "hono";
import { cache } from "hono/cache";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { bgmUrl, bgmProxy } from "../lib";

const app = new Hono();

const WIDTH = 1200;
const HEIGHT = 630;

let fontReady: Promise<ArrayBuffer> | null = null;
function loadFont(): Promise<ArrayBuffer> {
  if (!fontReady) {
    fontReady = fetch(
      "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/google-fonts/NotoSansSC[wght].ttf",
    ).then((r) => r.arrayBuffer());
  }
  return fontReady;
}

let wasmReady: Promise<void> | null = null;
function initWasmOnce(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(
      fetch("https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index.wasm").then((r) =>
        r.arrayBuffer(),
      ),
    ).catch(() => {
      wasmReady = null;
      throw new Error("wasm init failed");
    });
  }
  return wasmReady;
}

interface OgData {
  title: string;
  subtitle: string;
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
      images?: { large?: string };
      rating?: { score?: number };
    };
    return {
      title: s.name_cn || s.name,
      subtitle: subjectTypeLabel(s.type),
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
      subtitle: characterTypeLabel(c.type),
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
      subtitle: p.career?.join(", ") || "人物",
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

app.get(
  "/og/:type/:id",
  cache({ cacheName: "og-image", cacheControl: "max-age=86400" }),
  async (c) => {
    const type = c.req.param("type");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.text("Bad id", 400);

    const data = await loadOgData(type, id);
    if (!data) return c.text("Not found", 404);

    const [font] = await Promise.all([loadFont(), initWasmOnce()]);

    let imageBase64: string | null = null;
    if (data.image) {
      try {
        const imgRes = await fetch(data.image);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          imageBase64 = bufToBase64(buf);
        }
      } catch {}
    }

    const svg = await satori(
      (
        <div
          style={{
            width: `${WIDTH}px`,
            height: `${HEIGHT}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#171717",
            color: "#fafafa",
            padding: "60px",
            fontFamily: "Noto Sans SC",
          }}
        >
          <div style={{ display: "flex", gap: "40px", alignItems: "center", flex: "1" }}>
            {imageBase64 ? (
              <img
                src={`data:image/jpeg;base64,${imageBase64}`}
                width={300}
                height={400}
                style={{ borderRadius: "16px", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "300px",
                  height: "400px",
                  borderRadius: "16px",
                  backgroundColor: "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "40px",
                }}
              >
                Bangumi X
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: "1" }}>
              <div style={{ fontSize: "52px", fontWeight: 700, lineHeight: 1.2 }}>{data.title}</div>
              <div style={{ fontSize: "28px", color: "#a3a3a3" }}>{data.subtitle}</div>
              {data.score !== null && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "32px",
                    color: "#fbbf24",
                  }}
                >
                  ★ {data.score.toFixed(1)}
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: "24px", color: "#737373" }}>Bangumi X — 番组计划数据浏览</div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [{ name: "Noto Sans SC", data: font, weight: 400, style: "normal" as const }],
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
