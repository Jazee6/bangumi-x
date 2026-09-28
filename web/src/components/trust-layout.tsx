import { Link } from "@tanstack/react-router";
import { Tv } from "lucide-react";

export function TrustLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="app-blur sticky top-0 z-10 shrink-0 border-b">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Tv className="size-4" aria-hidden />
            Bangumi X
          </Link>
          <Link to="/" className="text-muted-foreground text-sm hover:underline">
            返回应用
          </Link>
        </div>
      </header>
      {children}
      <footer className="mt-auto border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-3xl flex-wrap gap-x-4 gap-y-2 px-4 py-6 text-xs sm:px-6">
          <Link to="/about">关于</Link>
          <Link to="/privacy">隐私说明</Link>
          <Link to="/terms">服务条款</Link>
        </div>
      </footer>
    </div>
  );
}
