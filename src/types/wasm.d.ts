/**
 * Cloudflare Workers convention: `import x from "./foo.wasm"` returns a
 * `WebAssembly.Module`. Wrangler / @cloudflare/vite-plugin bundles the file
 * into the Worker. Vite's own `vite/client` only declares `*.wasm?init`,
 * so we add the bare form here.
 */
declare module "*.wasm" {
	const wasmModule: WebAssembly.Module;
	export default wasmModule;
}
