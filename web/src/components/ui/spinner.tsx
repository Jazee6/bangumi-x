import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

const spinnerVariants = cva("size-4 animate-spin", {
  variants: {
    variant: {
      default: "",
      primary: "text-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Spinner({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"svg"> & VariantProps<typeof spinnerVariants>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      data-variant={variant}
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Spinner };
