import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "cn";

interface EntityImageProps {
  src: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
}

// 图片可能在水合前就已加载失败，此时 onError 不会再触发，所以挂载时也检查一次。
export function useImageFallback(src: string | null) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return {
    failed: !src || failedSrc === src,
    imageProps: {
      ref: (image: HTMLImageElement | null) => {
        if (image?.complete && image.naturalWidth === 0) setFailedSrc(src);
      },
      onError: () => setFailedSrc(src),
    },
  };
}

export function EntityImage({
  src,
  alt,
  className,
  iconClassName,
  priority,
  loading,
  fetchPriority,
}: EntityImageProps) {
  const { failed, imageProps } = useImageFallback(src);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "bg-muted text-muted-foreground flex size-full items-center justify-center",
          className,
        )}
      >
        <ImageOff className={cn("size-8", iconClassName)} aria-hidden="true" />
      </div>
    );
  }

  const imgLoading = loading ?? (priority ? "eager" : "lazy");
  const imgFetchPriority = fetchPriority ?? (priority ? "high" : "auto");

  return (
    <img
      src={src}
      alt={alt}
      className={cn("size-full object-cover", className)}
      loading={imgLoading}
      fetchPriority={imgFetchPriority}
      decoding="async"
      {...imageProps}
    />
  );
}
