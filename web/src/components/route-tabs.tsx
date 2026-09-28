import { cn } from "cn";

export const routeTabClassName =
  "inline-flex h-7 items-center justify-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=date]:bg-background aria-[current=date]:text-foreground aria-[current=page]:bg-background aria-[current=page]:text-foreground dark:text-muted-foreground dark:hover:text-foreground dark:aria-[current=date]:bg-input/30 dark:aria-[current=date]:text-foreground dark:aria-[current=page]:bg-input/30 dark:aria-[current=page]:text-foreground";

export function RouteTabs({ className, ...props }: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-full p-1",
        className,
      )}
      {...props}
    />
  );
}
