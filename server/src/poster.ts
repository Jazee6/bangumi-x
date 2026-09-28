import { isRecord } from "./validation";

const POSTER_HOSTS = new Set(["lain.bgm.tv", "bgmimg.anibt.net"]);
const ALLOWED_IMAGE_PATHS = [/^\/pic\/cover\//, /^(?:\/r\/\d+)?\/pic\/crt\//];

export const IMAGE_VARIANTS = ["grid", "common", "large"] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

const VARIANT_FALLBACKS: Record<ImageVariant, readonly string[]> = {
  grid: ["grid", "small", "common", "medium", "large"],
  common: ["common", "medium", "large", "small", "grid"],
  large: ["large", "common", "medium", "small", "grid"],
};

export function parseImageVariant(value: unknown): ImageVariant | null {
  return typeof value === "string" && IMAGE_VARIANTS.includes(value as ImageVariant)
    ? (value as ImageVariant)
    : null;
}

export function getProxiedEntityImageUrl(
  value: unknown,
  workerOrigin: string,
  variant: ImageVariant = "large",
): string | null {
  if (!isRecord(value)) return null;

  for (const size of VARIANT_FALLBACKS[variant]) {
    const proxyUrl = getProxiedImageUrl(value[size], workerOrigin, variant);
    if (proxyUrl) return proxyUrl;
  }

  return null;
}

export function getProxiedImageUrl(
  value: unknown,
  workerOrigin: string,
  variant: ImageVariant = "large",
): string | null {
  const upstreamUrl = parseAllowedPosterUrl(value);
  if (!upstreamUrl) return null;
  const proxyUrl = new URL("/images", workerOrigin);
  proxyUrl.searchParams.set("url", upstreamUrl.toString());
  proxyUrl.searchParams.set("size", variant);
  return proxyUrl.toString();
}

export function parseProxiedImageSource(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const proxyUrl = new URL(value);
    if (proxyUrl.pathname !== "/images" || !parseImageVariant(proxyUrl.searchParams.get("size"))) {
      return null;
    }
    return parseAllowedPosterUrl(proxyUrl.searchParams.get("url"));
  } catch {
    return null;
  }
}

export function parseAllowedPosterUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      POSTER_HOSTS.has(url.hostname) &&
      ALLOWED_IMAGE_PATHS.some((pattern) => pattern.test(url.pathname))
    ) {
      url.protocol = "https:";
      return url;
    }
    return null;
  } catch {
    return null;
  }
}
