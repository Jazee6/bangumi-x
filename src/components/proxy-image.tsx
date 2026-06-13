import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

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
					"flex items-center justify-center bg-muted text-muted-foreground",
					className,
				)}
			>
				<ImageIcon className="size-8" />
			</div>
		);
	}

	const proxiedSrc = `/api/image?url=${encodeURIComponent(src)}`;

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
