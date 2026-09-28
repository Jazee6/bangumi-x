declare module "*.wasm" {
  const asset: string | WebAssembly.Module;
  export default asset;
}

declare module "*.ttf" {
  const asset: string | ArrayBuffer;
  export default asset;
}
