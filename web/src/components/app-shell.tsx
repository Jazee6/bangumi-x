import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ProgressProvider, useProgress } from "@bprogress/react";
import { useRouterState } from "@tanstack/react-router";

import type { SourceMetadata } from "share";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "cn";

interface HeaderTitleContextValue {
  setHeaderTitle: (title: string | null) => void;
}

const HeaderTitleContext = createContext<HeaderTitleContextValue | null>(null);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [headerTitle, setHeaderTitle] = useState<string | null>(null);
  const source = useRouterState({
    select: (state) => {
      for (const match of [...state.matches].reverse()) {
        const data = match.loaderData;
        if (data && typeof data === "object" && "source" in data) {
          return (data as { source?: SourceMetadata }).source;
        }
      }
      return undefined;
    },
  });

  return (
    <ProgressProvider color="var(--primary)" height="4px" options={{ showSpinner: false }}>
      <RouteProgress />
      <HeaderTitleContext.Provider value={{ setHeaderTitle }}>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="app-blur border-sidebar-border sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 px-4">
                <SidebarTrigger />
                <div className="min-w-0 flex-1">
                  <span
                    data-slot="header-title"
                    className={cn(
                      "block truncate text-sm font-medium transition-all duration-150 ease-out",
                      headerTitle
                        ? "translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-1 opacity-0",
                    )}
                  >
                    {headerTitle ?? ""}
                  </span>
                </div>
                <HeaderActions source={source} />
              </header>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </HeaderTitleContext.Provider>
    </ProgressProvider>
  );
}

function RouteProgress() {
  const isLoading = useRouterState({ select: (state) => state.isLoading });
  const { start, stop } = useProgress();

  useEffect(() => {
    if (isLoading) start();
    else stop();
  }, [isLoading, start, stop]);

  return null;
}

/**
 * 页面主标题。滚动离开视口后在顶部 Header 中显示。
 */
export function HeaderTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(HeaderTitleContext);
  const ref = useRef<HTMLHeadingElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const heading = ref.current;
    if (!heading) return;

    const observer = new IntersectionObserver(([entry]) => setHidden(!entry?.isIntersecting), {
      rootMargin: "-48px 0px 0px 0px",
    });
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    context?.setHeaderTitle(hidden ? textContentOf(children) : null);
    return () => context?.setHeaderTitle(null);
  }, [context, hidden, children]);

  return (
    <h1 ref={ref} className={className}>
      {children}
    </h1>
  );
}

function textContentOf(node: React.ReactNode): string | null {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    const text = node.map(textContentOf).filter(Boolean).join("");
    return text || null;
  }
  return null;
}
