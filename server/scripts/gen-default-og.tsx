import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { readFileSync } from "node:fs";

const WIDTH = 1200;
const HEIGHT = 630;
const FONT_BASE = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest";
const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2-5 5-5-5"/><rect width="20" height="15" x="2" y="7" rx="2"/></svg>';
const ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString("base64")}`;

async function main() {
  const wasmPath = resolve("node_modules/@resvg/resvg-wasm/index_bg.wasm");
  await initWasm(readFileSync(wasmPath));

  const [font400, font700] = await Promise.all([
    fetch(`${FONT_BASE}/chinese-simplified-400-normal.woff`).then((r) => r.arrayBuffer()),
    fetch(`${FONT_BASE}/chinese-simplified-700-normal.woff`).then((r) => r.arrayBuffer()),
  ]);

  const svg = await satori(
    <div
      style={{
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        backgroundColor: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "Noto Sans SC",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <img src={ICON_DATA_URI} width={80} height={80} />
        <div style={{ fontSize: "80px", fontWeight: 700, color: "#fafafa" }}>Bangumi X</div>
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
  const out = resolve("../web/public/og-default.png");
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.byteLength} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
