import { Link, useMatches } from "@tanstack/react-router";
import {
  FilmIcon,
  HomeIcon,
  MoonIcon,
  SunIcon,
  TvIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
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
} from "@/components/ui/sidebar.tsx";

const navItems = [
  { to: "/" as const, label: "首页", icon: HomeIcon },
  { to: "/subjects" as const, label: "条目", icon: FilmIcon },
  { to: "/characters" as const, label: "角色", icon: UserRoundIcon },
  { to: "/persons" as const, label: "人物", icon: UsersIcon },
];

export function AppSidebar() {
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.pathname ?? "/";
  const { theme, setTheme } = useTheme();

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
            <SidebarMenuButton
              tooltip="切换主题"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <SunIcon className="hidden [html:not(.dark)_&]:block" />
              <MoonIcon className="hidden [html.dark_&]:block" />
              <span>切换主题</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
