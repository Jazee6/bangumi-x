import { ImageIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils.ts";

interface ProxyImageProps extends React.ComponentProps<"img"> {
  src: string | undefined;
  alt: string;
}

export function ProxyImage({ src, alt, className, ...props }: ProxyImageProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground rounded-xl",
          className,
        )}
      >
        <ImageIcon className="size-6" />
      </div>
    );
  }

  const apiBase = (import.meta.env.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
  const proxiedSrc = `${apiBase}/bgm/image?url=${encodeURIComponent(src)}`;

  return (
    <img
      src={proxiedSrc}
      alt={alt}
      className={cn("object-cover", className)}
      onError={handleError}
      loading="lazy"
      {...props}
    />
  );
}
