/**
 * 集中加载 OG 渲染所需的两个 WASM：
 *   - satori 用的 yoga.wasm（布局引擎）
 *   - @resvg/resvg-wasm 的 SVG 光栅化器
 *
 * Cloudflare Workers 上 `import mod from "x.wasm"` 默认导出 `WebAssembly.Module`，
 * Wrangler 会把 wasm 打包进 Worker。`@cloudflare/vite-plugin` 在 dev/build 都遵循这个语义。
 *
 * 两个 init API（`satori/wasm` 的 `init` 与 `@resvg/resvg-wasm` 的 `initWasm`）都接受
 * `WebAssembly.Module`，所以直接传即可，无需 fetch+ArrayBuffer。
 *
 * `initOgWasm()` 幂等：冷启动跑一次，后续请求复用同一隔离器。
 */
import { initWasm as initResvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
// `satori/standalone` 是不内嵌 yoga.wasm 的入口，调用方自己 init。
// 比起默认入口（会试图同步加载 wasm）更适合 Workers / Vite 打包。
import { init as initSatori } from "satori/standalone";
import yogaWasm from "satori/yoga.wasm";

let initPromise: Promise<void> | undefined;

export function initOgWasm(): Promise<void> {
	if (!initPromise) {
		initPromise = Promise.all([
			initSatori(yogaWasm),
			initResvg(resvgWasm),
		]).then(() => undefined);
	}
	return initPromise;
}
