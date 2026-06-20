declare module "@bprogress/core/css";

declare module "subset-font" {
	const subsetFont: (
		buffer: Buffer | ArrayBuffer | Uint8Array,
		text: string,
		options?: {
			targetFormat?: "sfnt" | "truetype" | "woff" | "woff2";
			preserveNameIds?: number[];
			noLayoutClosure?: boolean;
		},
	) => Promise<Buffer>;
	export default subsetFont;
}
