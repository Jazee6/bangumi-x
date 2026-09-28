// 用微信开发者工具的自动化接口逐页截图，用于在本地验证 Mini 渲染。
// 用法：bun scripts/mini-screenshot.ts <输出目录> <页面路径>...
// 页面路径如 "/pages/index/index" 或 "/pages/subjects/detail/index?id=1"；可在路径后追加 "#scroll=600" 先滚动再截图。
// 需要开发者工具已登录并开启服务端口，且已用 `cli auto --project mini --auto-port 9420` 打开自动化。
// 热重载不会重新编译 wxss；改过样式后先 `cli close --project mini` 再重新执行 `cli auto`。
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import automator from "miniprogram-automator";

const [outDir, ...pages] = process.argv.slice(2);

if (!outDir || pages.length === 0) {
  console.error("用法：bun scripts/mini-screenshot.ts <输出目录> <页面路径>...");
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });

try {
  for (const [index, entry] of pages.entries()) {
    const [url, hash = ""] = entry.split("#");
    const scroll = Number(new URLSearchParams(hash).get("scroll") ?? 0);
    const page = await miniProgram.reLaunch(url);
    await page?.waitFor(2500);
    if (scroll > 0) {
      await miniProgram.pageScrollTo(scroll);
      await page?.waitFor(800);
    }
    const name = `${String(index).padStart(2, "0")}-${url.replace(/^\//, "").replace(/[/?=&]/g, "_")}.png`;
    await miniProgram.screenshot({ path: resolve(outDir, name) });
    console.log(resolve(outDir, name));
  }
} finally {
  miniProgram.disconnect();
}
