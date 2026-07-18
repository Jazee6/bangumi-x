import { Link, useMatches } from "@tanstack/react-router";
import {
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  FilmIcon,
  HomeIcon,
  IdCardIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
  TvIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient, useSession } from "@/lib/auth-client.ts";

const navItems = [
  { to: "/" as const, label: "首页", icon: HomeIcon },
  { to: "/subjects" as const, label: "条目", icon: FilmIcon },
  { to: "/characters" as const, label: "角色", icon: UserRoundIcon },
  { to: "/persons" as const, label: "人物", icon: UsersIcon },
];

export function AppSidebar() {
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.pathname ?? "/";
  const { isMobile } = useSidebar();
  const { data, error, isPending, isRefetching, refetch } = useSession();
  const [authAction, setAuthAction] = useState<"sign-in" | "sign-out" | null>(null);

  const signIn = async () => {
    setAuthAction("sign-in");
    try {
      const result = await authClient.signIn.oauth2({
        providerId: "easy-auth",
        callbackURL: window.location.href,
      });
      if (result.error) toast.error(result.error.message);
    } catch {
      toast.error("无法连接身份服务");
    } finally {
      setAuthAction(null);
    }
  };

  const signOut = async () => {
    setAuthAction("sign-out");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        toast.error(result.error.message);
      } else {
        await refetch();
      }
    } catch {
      toast.error("退出登录失败");
    } finally {
      setAuthAction(null);
    }
  };

  const user = data?.user;
  const accountUrl = `${import.meta.env.VITE_ACCOUNT_URL.replace(/\/$/, "")}/profile`;

  return (
    <Sidebar collapsible="icon">
      <SidebarRail />

      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />} tooltip="Bangumi X">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <TvIcon className="size-4" />
              </div>
              <span className="text-base font-semibold">Bangumi X</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<Link to={item.to} />}
                    tooltip={item.label}
                    isActive={
                      item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to)
                    }
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {isPending ? (
              <div className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:px-0">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
            ) : error ? (
              <SidebarMenuButton
                size="lg"
                tooltip="身份服务暂不可用"
                className="group-data-[collapsible=icon]:justify-center"
                disabled={isRefetching}
                onClick={() => void refetch()}
              >
                {isRefetching ? <Spinner /> : <RefreshCwIcon />}
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">身份服务暂不可用</span>
                  <span className="truncate text-xs text-muted-foreground">点击重试</span>
                </div>
              </SidebarMenuButton>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      tooltip={user.name}
                      className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                    >
                      <Avatar>
                        {user.image && <AvatarImage src={user.image} alt={user.name} />}
                        <AvatarFallback>{user.name.trim().slice(0, 2) || "用户"}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-medium">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      </div>
                      <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  }
                />
                <DropdownMenuContent
                  className="min-w-56"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Avatar>
                      {user.image && <AvatarImage src={user.image} alt={user.name} />}
                      <AvatarFallback>{user.name.trim().slice(0, 2) || "用户"}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    render={<a href={accountUrl} target="_blank" rel="noopener noreferrer" />}
                  >
                    <IdCardIcon />
                    账户设置
                    <ExternalLinkIcon className="ml-auto" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={authAction === "sign-out"} onClick={signOut}>
                    {authAction === "sign-out" ? <Spinner /> : <LogOutIcon />}
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton
                size="lg"
                tooltip="登录"
                className="group-data-[collapsible=icon]:justify-center"
                disabled={authAction === "sign-in"}
                onClick={signIn}
              >
                {authAction === "sign-in" ? <Spinner /> : <LogInIcon />}
                <span className="group-data-[collapsible=icon]:hidden">登录</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
