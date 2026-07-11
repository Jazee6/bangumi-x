// Lucide icons as base64-encoded SVG data URIs (pre-encoded, no runtime dependency)
// chevron-left / chevron-right / chevron-down, in foreground and muted-foreground colors

const FG_LIGHT = "%2318181b";
const FG_DARK = "%23fafafa";
const MUTED_LIGHT = "%2371717a";
const MUTED_DARK = "%23a1a1aa";

function svg(color: string, path: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='${path}'/%3E%3C/svg%3E`;
}

const CHEVRON_LEFT = "m15 18-6-6 6-6";
const CHEVRON_RIGHT = "m9 18 6-6-6-6";
const CHEVRON_DOWN = "m6 9 6 6 6-6";
const COPY = "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1";

export const ICON_BACK_LIGHT = svg(FG_LIGHT, CHEVRON_LEFT);
export const ICON_BACK_DARK = svg(FG_DARK, CHEVRON_LEFT);
export const ICON_CHEVRON_RIGHT_LIGHT = svg(MUTED_LIGHT, CHEVRON_RIGHT);
export const ICON_CHEVRON_RIGHT_DARK = svg(MUTED_DARK, CHEVRON_RIGHT);
export const ICON_CHEVRON_DOWN_LIGHT = svg(MUTED_LIGHT, CHEVRON_DOWN);
export const ICON_CHEVRON_DOWN_DARK = svg(MUTED_DARK, CHEVRON_DOWN);
export const ICON_COPY_LIGHT = svg(MUTED_LIGHT, COPY);
export const ICON_COPY_DARK = svg(MUTED_DARK, COPY);
