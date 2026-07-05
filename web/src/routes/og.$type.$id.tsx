import { createFileRoute } from "@tanstack/react-router";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { getCharacter, getPerson, getSubject } from "@/server/functions.ts";
import { CharacterTypeLabel, SubjectTypeLabel } from "@/types";
import { WORKER_URL } from "@/lib/seo/site.ts";

const WIDTH = 1200;
const HEIGHT = 630;

let fontCache: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/google-fonts/NotoSansSC[wght].ttf",
  );
  fontCache = await res.arrayBuffer();
  return fontCache;
}

async function fetchImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/og/$type/$id")({
  headers: () => ({
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
  }),
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        const type = params.type as "subjects" | "characters" | "persons";

        let title = "";
        let subtitle = "";
        let score: number | null = null;
        let imageBase64: string | null = null;

        const font = await loadFont();

        if (type === "subjects") {
          const s = await getSubject({ data: { id } });
          if (!s) return new Response("Not found", { status: 404 });
          title = s.name_cn || s.name;
          subtitle = SubjectTypeLabel[s.type] ?? "条目";
          if (s.date) subtitle += ` · ${s.date}`;
          if (s.rating?.score > 0) score = s.rating.score;
          if (s.images?.large) {
            const buf = await fetchImage(
              `${WORKER_URL}/bgm/image?url=${encodeURIComponent(s.images.large)}`,
            );
            if (buf) imageBase64 = bufToBase64(buf);
          }
        } else if (type === "characters") {
          const c = await getCharacter({ data: { id } });
          if (!c) return new Response("Not found", { status: 404 });
          title = c.name;
          subtitle = c.type ? (CharacterTypeLabel[c.type] ?? "角色") : "角色";
          if (c.images?.large) {
            const buf = await fetchImage(
              `${WORKER_URL}/bgm/image?url=${encodeURIComponent(c.images.large)}`,
            );
            if (buf) imageBase64 = bufToBase64(buf);
          }
        } else if (type === "persons") {
          const p = await getPerson({ data: { id } });
          if (!p) return new Response("Not found", { status: 404 });
          title = p.name;
          subtitle = p.career?.map((c) => c).join(", ") || "人物";
          if (p.images?.large) {
            const buf = await fetchImage(
              `${WORKER_URL}/bgm/image?url=${encodeURIComponent(p.images.large)}`,
            );
            if (buf) imageBase64 = bufToBase64(buf);
          }
        } else {
          return new Response("Bad type", { status: 400 });
        }

        const svg = await satori(
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
                <div style={{ fontSize: "52px", fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
                <div style={{ fontSize: "28px", color: "#a3a3a3" }}>{subtitle}</div>
                {score !== null && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "32px",
                      color: "#fbbf24",
                    }}
                  >
                    ★ {score.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontSize: "24px", color: "#737373" }}>Bangumi X — 番组计划数据浏览</div>
          </div>,
          {
            width: WIDTH,
            height: HEIGHT,
            fonts: [{ name: "Noto Sans SC", data: font, weight: 400, style: "normal" }],
          },
        );

        const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
        return new Response(png as unknown as BodyInit, {
          headers: { "Content-Type": "image/png" },
        });
      },
    },
  },
});

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
