import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const skeletonVariants = cva("animate-pulse bg-muted", {
  variants: {
    shape: {
      default: "rounded-2xl",
      text: "rounded",
      media: "rounded-lg",
      badge: "rounded-3xl",
      control: "rounded-4xl",
      pill: "rounded-full",
    },
  },
  defaultVariants: {
    shape: "default",
  },
});

function Skeleton({
  className,
  shape = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      data-shape={shape}
      className={cn(skeletonVariants({ shape, className }))}
      {...props}
    />
  );
}

export { Skeleton };
