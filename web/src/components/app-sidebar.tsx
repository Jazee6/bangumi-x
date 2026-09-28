import { lazy, Suspense, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  CalendarDays,
  ChevronsUpDown,
  CircleUserRound,
  Compass,
  ListChecks,
  Link2,
  LogIn,
  LogOut,
  Trophy,
  Tv,
} from "lucide-react";

import { useImageFallback } from "@/components/entity-image";
import { useLogin } from "@/components/sign-in";
import { authClient, safeReturnTarget, useHydratedSession } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

const MiniAccountLinkDialog = lazy(() =>
  import("@/components/mini-account-link-dialog").then((module) => ({
    default: module.MiniAccountLinkDialog,
  })),
);

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isHome = pathname === "/" || pathname.startsWith("/schedule/");
  const isDiscover = pathname.startsWith("/discover");
  const isRankings = pathname.startsWith("/rankings");
  const isCollections = pathname === "/collections";
  const isProgress = pathname === "/progress";
  const { data: session, isPending: sessionPending } = useHydratedSession();
  const [signingOut, setSigningOut] = useState(false);
  const { loggingIn, login } = useLogin();
  const [accountLinkOpen, setAccountLinkOpen] = useState(false);
  // 关联弹窗连同二维码编码器按需加载，首次打开后保持挂载以保留关闭动画。
  const [accountLinkRequested, setAccountLinkRequested] = useState(false);
  const avatar = useImageFallback(session?.user.image ?? null);

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Bangumi X" render={<Link to="/" />}>
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Tv />
                </span>
                <span className="truncate font-semibold">Bangumi X</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={isHome} tooltip="每日放送" render={<Link to="/" />}>
                    <CalendarDays />
                    <span>每日放送</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isDiscover}
                    tooltip="发现"
                    render={
                      <Link
                        to="/discover/$type"
                        params={{ type: "anime" }}
                        search={{ tab: "subjects", page: 1 }}
                      />
                    }
                  >
                    <Compass />
                    <span>发现</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isRankings}
                    tooltip="排行榜"
                    render={<Link to="/rankings" />}
                  >
                    <Trophy />
                    <span>排行榜</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isCollections}
                    tooltip="收藏"
                    render={<Link to="/collections" />}
                  >
                    <Bookmark />
                    <span>收藏</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isProgress}
                    tooltip="进度"
                    render={<Link to="/progress" search={{ stage: "in_progress" }} />}
                  >
                    <ListChecks />
                    <span>进度</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {sessionPending ? (
            <div className="flex h-14 items-center gap-2 px-3 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!">
              <Skeleton shape="pill" className="size-8" />
              <Skeleton className="h-4 flex-1 group-data-[collapsible=icon]:hidden" />
            </div>
          ) : session ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<SidebarMenuButton size="lg" tooltip={session.user.name} />}
                  >
                    <span className="bg-muted relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                      <CircleUserRound className="size-5" />
                      {!avatar.failed && (
                        <img
                          src={session.user.image ?? undefined}
                          alt=""
                          className="bg-muted absolute inset-0 size-full object-cover"
                          referrerPolicy="no-referrer"
                          {...avatar.imageProps}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{session.user.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {session.user.email}
                      </span>
                    </span>
                    <ChevronsUpDown />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start">
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountLinkRequested(true);
                        setAccountLinkOpen(true);
                      }}
                    >
                      <Link2 />
                      关联番迹
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={signingOut}
                      onClick={async () => {
                        setSigningOut(true);
                        const result = await authClient.signOut();
                        setSigningOut(false);
                        if (result.error) {
                          toast.add({
                            title: "退出登录失败，请重试。",
                            type: "error",
                            priority: "high",
                          });
                        }
                      }}
                    >
                      {signingOut ? <Spinner /> : <LogOut />}
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip="登录"
                  disabled={loggingIn}
                  onClick={() =>
                    void login(
                      safeReturnTarget(`${window.location.pathname}${window.location.search}`),
                    )
                  }
                >
                  <span className="flex size-8 shrink-0 items-center justify-center">
                    {loggingIn ? <Spinner /> : <LogIn />}
                  </span>
                  <span>登录</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {accountLinkRequested && (
        <Suspense fallback={null}>
          <MiniAccountLinkDialog open={accountLinkOpen} onOpenChange={setAccountLinkOpen} />
        </Suspense>
      )}
    </>
  );
}
