import { cn } from "cn";

export function CrawlNavigation({ className, ...props }: React.ComponentPropsWithoutRef<"nav">) {
  return <nav className={cn("sr-only focus-within:not-sr-only", className)} {...props} />;
}
