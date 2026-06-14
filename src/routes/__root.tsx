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
import { FileQuestionIcon } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/app-sidebar";
import { EmptyState } from "@/components/empty-state";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { version } from "../../package.json";
import { BProgress } from "@bprogress/core";
import { type ReactNode, useEffect } from "react";
// @ts-expect-error
import "@bprogress/core/css";

interface MyRouterContext {
	queryClient: QueryClient;
}

BProgress.configure({
	showSpinner: false,
});

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Bangumi X" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
			{ rel: "manifest", href: "/manifest.json" },
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: () => (
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
	),
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

							<SidebarInset className="h-[calc(100svh-1rem)] relative">
								<header className="absolute w-full top-0 z-20 flex h-12 items-center gap-2 px-4 app-blur rounded-t-[18px]">
									<SidebarTrigger className="-ml-1" />
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
														className: "ml-auto",
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
								</header>

								<div className="pt-12 overflow-auto">
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
