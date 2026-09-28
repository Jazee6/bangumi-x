import { Link } from "@tanstack/react-router";
import { Database, Ellipsis, ExternalLink, Info, Monitor, Moon, Sun } from "lucide-react";

import type { SourceMetadata } from "share";

import { version as appVersion } from "../../../package.json";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Theme, useTheme } from "@/features/theme/theme";

export function HeaderActions({ source }: { source?: SourceMetadata }) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <ThemeAction />
      <MoreAction source={source} />
    </div>
  );
}

function MoreAction({ source }: { source?: SourceMetadata }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="更多" />}>
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <SourceMenu source={source} />
        <MiniProgramMenu />
        <GitHubItem />
        <AboutMenu />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SourceMenu({ source }: { source?: SourceMetadata }) {
  const fetchedAt = source ? new Date(source.fetchedAt) : null;
  const validFetchedAt = fetchedAt && !Number.isNaN(fetchedAt.getTime());

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Database />
        数据来源
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">
        <div className="p-2">
          <p className="text-sm font-medium">数据来源</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {source ? "当前页面事实来自 Bangumi。" : "当前页面为 Bangumi X 站内内容。"}
          </p>
          {source && (
            <div className="mt-3 space-y-2 text-sm">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                在 Bangumi 核验原始数据 <ExternalLink className="size-3.5" />
              </a>
              <p className="text-muted-foreground">条目资料依 CC BY-SA 3.0 提供。</p>
              {validFetchedAt && (
                <p className="text-muted-foreground">
                  来源获取时间：
                  <time dateTime={source.fetchedAt}>
                    {fetchedAt.toLocaleString("zh-CN", {
                      timeZone: "Asia/Shanghai",
                      hour12: false,
                    })}
                  </time>
                </p>
              )}
            </div>
          )}
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function MiniProgramMenu() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <MiniProgramIcon />
        小程序
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        <img
          src="/mini.webp"
          alt="用于打开 Bangumi X 微信小程序的小程序码"
          className="block size-full rounded-2xl"
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function GitHubItem() {
  return (
    <DropdownMenuItem
      render={
        <a
          href="https://github.com/Jazee6/bangumi-x"
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`在 GitHub 查看 Bangumi X v${appVersion}`}
        />
      }
    >
      <GitHubIcon />
      GitHub
      <ExternalLink className="text-muted-foreground ml-auto size-3.5" />
    </DropdownMenuItem>
  );
}

function AboutMenu() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Info />
        关于
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem render={<Link to="/about" />}>关于</DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/privacy" />}>隐私说明</DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/terms" />}>服务条款</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.24c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.18c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}

function MiniProgramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10m0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16m1-6a3.5 3.5 0 1 1-4.977-3.174 1 1 0 1 1 .845 1.813A1.5 1.5 0 1 0 11 14v-4a3.5 3.5 0 1 1 4.977 3.174 1 1 0 0 1-.845-1.813A1.5 1.5 0 1 0 13 10z"
      />
    </svg>
  );
}

function ThemeAction() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="选择主题" />}>
        <Icon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          <DropdownMenuRadioItem value="light">
            <Sun />
            亮色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            暗色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            跟随系统
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
