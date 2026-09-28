import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const labelVariants = cva(
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        option:
          "border-border w-full min-w-0 cursor-pointer rounded-md border px-3 py-2 data-[selected=true]:bg-secondary data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Label({
  className,
  variant,
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) {
  return (
    <label data-slot="label" className={cn(labelVariants({ variant }), className)} {...props} />
  );
}

export { Label };
