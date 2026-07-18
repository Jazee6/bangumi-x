import { BProgress } from "@bprogress/core";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { FileQuestionIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar.tsx";
import { EmptyState } from "@/components/empty-state.tsx";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { buildMeta, SITE_DESCRIPTION, SITE_NAME, SITE_URL, websiteJsonLd } from "@/lib/seo/site.ts";
import { version } from "../../package.json";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools.tsx";
import appCss from "../styles.css?url";
import "@bprogress/core/css";

interface MyRouterContext {
  queryClient: QueryClient;
}

BProgress.configure({
  showSpinner: false,
});

function ThemeMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="选择主题">
            <SunIcon className="hidden [html:not(.dark)_&]:block size-5" />
            <MoonIcon className="hidden [html.dark_&]:block size-5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40 min-w-40">
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={(value) => value && setTheme(value)}
        >
          <DropdownMenuRadioItem value="light">
            <SunIcon />
            浅色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon />
            深色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon />
            跟随系统
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      ...buildMeta({
        title: "番组计划数据浏览",
        description: SITE_DESCRIPTION,
        url: "/",
        jsonLd: websiteJsonLd(),
      }).meta,
      { name: "application-name", content: SITE_NAME },
      { name: "theme-color", content: "#171717" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "alternate", hrefLang: "zh-CN", href: SITE_URL },
      { rel: "alternate", hrefLang: "x-default", href: SITE_URL },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState
          icon={FileQuestionIcon}
          title="页面未找到"
          description="你访问的页面不存在"
          action={
            <Link to="/">
              <Button variant="secondary">返回首页</Button>
            </Link>
          }
        />
      </div>
    );
  },
});

function RootDocument({ children }: { children: ReactNode }) {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });

  useEffect(() => {
    if (isLoading) {
      BProgress.start();
    } else {
      BProgress.done();
    }
  }, [isLoading]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />

              <SidebarInset className="relative">
                <header className="sticky top-0 z-20 flex h-12 items-center gap-2 px-4 app-blur">
                  <SidebarTrigger className="-ml-1" />
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label="微信小程序"
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                            className: "ml-auto",
                          })}
                        >
                          <svg
                            className="size-5 text-primary"
                            viewBox="5 5 14 14"
                            fill="currentColor"
                            role="img"
                            aria-label="微信小程序"
                          >
                            <title>微信小程序</title>
                            <path d="M15.84 12.69c-.16.05-.32.08-.48.08-.61 0-.95-.41-.77-.92.14-.37.49-.68.93-.83.67-.24 1.14-.8 1.14-1.45 0-.88-.85-1.59-1.91-1.59-1.05 0-1.9.71-1.9 1.59v4.86c0 1.17-.68 2.2-1.7 2.78-.55.32-1.2.5-1.9.5-1.98 0-3.6-1.47-3.6-3.28 0-.57.17-1.11.45-1.58.45-.73 1.19-1.29 2.07-1.54.16-.05.31-.08.46-.08.62 0 .96.42.77.93-.13.34-.46.64-.86.8-.05.01-.09.03-.14.05-.63.26-1.06.8-1.06 1.42 0 .88.85 1.59 1.91 1.59 1.05 0 1.9-.71 1.9-1.59V9.57c0-1.18.68-2.2 1.7-2.78.55-.32 1.2-.5 1.9-.5 1.99 0 3.6 1.47 3.6 3.28 0 .57-.16 1.11-.45 1.58-.44.73-1.18 1.29-2.06 1.54Z" />
                          </svg>
                        </button>
                      }
                    />
                    <TooltipContent side="bottom" className="p-2">
                      <img src="/mini.webp" alt="微信小程序码" className="size-40 rounded-lg" />
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          href="https://github.com/Jazee6/bangumi-x"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="GitHub"
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                          })}
                        >
                          <svg
                            className="size-5"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            role="img"
                            aria-label="GitHub"
                          >
                            <title>GitHub</title>
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                          </svg>
                        </a>
                      }
                    />
                    <TooltipContent>v{version}</TooltipContent>
                  </Tooltip>
                  <ThemeMenu />
                </header>

                <div className="md:overflow-auto">
                  <div className="p-4 md:p-6">{children}</div>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>

        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
