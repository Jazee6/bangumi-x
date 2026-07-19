import { AlertCircleIcon, CheckCircle2Icon, Link2OffIcon, QrCodeIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { authClient } from "@/lib/auth-client.ts";

const API_BASE = import.meta.env.VITE_API_URL.replace(/\/$/, "");
const REOPEN_KEY = "mini-binding-reauth";

type TerminalStatus = "confirmed" | "rejected" | "expired" | "replaced" | "consumed" | "conflict";
type ViewState =
  | { kind: "idle" | "loading" | "reauth" | "reauthenticating" }
  | { kind: "pending"; id: string; payload: string; expiresAt: number; qrUrl?: string }
  | { kind: TerminalStatus; expiresAt: number; conflictReason?: "openid" | "target" }
  | { kind: "bound" | "confirm-unbind" | "unbinding" | "unbound" }
  | { kind: "error"; message: string };

interface ApiErrorBody {
  code?: string;
  message?: string;
}

class BindingApiError extends Error {
  constructor(readonly code: string | undefined, message: string) {
    super(message);
  }
}

async function bindingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/auth${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new BindingApiError(body.code, body.message ?? "请求失败");
  }
  return body;
}

function terminalCopy(status: TerminalStatus) {
  switch (status) {
    case "rejected":
      return { title: "绑定已拒绝", description: "小程序端取消了本次请求。" };
    case "expired":
      return { title: "二维码已过期", description: "请生成新的二维码后重新扫描。" };
    case "replaced":
      return { title: "二维码已替换", description: "这张二维码已失效，请使用最新生成的二维码。" };
    case "confirmed":
      return { title: "绑定成功", description: "小程序已切换为当前统一账户。" };
    case "consumed":
      return { title: "请求已使用", description: "这次请求不能再次确认，请检查当前绑定状态。" };
    case "conflict":
      return { title: "无法完成绑定", description: "微信身份或当前账户已经存在其他绑定。" };
  }
}

export function MiniBindingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewState>({ kind: "idle" });
  const createSequence = useRef(0);

  const loadBindingStatus = async () => {
    const sequence = ++createSequence.current;
    setView({ kind: "loading" });
    try {
      const result = await bindingFetch<{ status: "bound" | "unbound" }>("/mini-binding/status");
      if (createSequence.current !== sequence) return;
      if (result.status === "bound") setView({ kind: "bound" });
      else void createChallenge();
    } catch {
      if (createSequence.current === sequence) setView({ kind: "error", message: "无法获取小程序绑定状态" });
    }
  };

  const createChallenge = async () => {
    const sequence = ++createSequence.current;
    setView({ kind: "loading" });
    try {
      const challenge = await bindingFetch<{
        id: string;
        payload: string;
        expiresAt: number;
        status: "pending";
      }>("/mini-binding/challenge", { method: "POST", body: "{}" });
      if (createSequence.current !== sequence) return;
      setView({ kind: "pending", ...challenge });
    } catch (error) {
      if (createSequence.current !== sequence) return;
      if (
        error instanceof BindingApiError &&
        error.code === "MINI_BINDING_RECENT_AUTH_REQUIRED"
      ) {
        setView({ kind: "reauth" });
      } else if (error instanceof BindingApiError && error.code === "MINI_BINDING_TARGET_CONFLICT") {
        setView({ kind: "bound" });
      } else {
        setView({ kind: "error", message: "暂时无法创建绑定二维码" });
      }
    }
  };

  useEffect(() => {
    if (!open || view.kind !== "idle") return;
    void loadBindingStatus();
  }, [open, view.kind]);

  useEffect(() => {
    if (!open || view.kind !== "pending" || view.qrUrl) return;
    let active = true;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(view.payload, { width: 256, margin: 1, errorCorrectionLevel: "M" }),
      )
      .then((qrUrl) => {
        if (active) setView((current) => (current.kind === "pending" ? { ...current, qrUrl } : current));
      })
      .catch(() => {
        if (active) setView({ kind: "error", message: "二维码生成失败" });
      });
    return () => {
      active = false;
    };
  }, [open, view]);

  useEffect(() => {
    if (!open || view.kind !== "pending") return;
    const controller = new AbortController();
    let timer = 0;
    const poll = async () => {
      try {
        const result = await bindingFetch<{ status: "pending" | TerminalStatus; expiresAt: number; conflictReason?: "openid" | "target" }>(
          `/mini-binding/challenge/status?id=${encodeURIComponent(view.id)}`,
          { signal: controller.signal },
        );
        if (result.status !== "pending") {
          setView({ kind: result.status, expiresAt: result.expiresAt, conflictReason: result.conflictReason });
          return;
        }
        timer = window.setTimeout(poll, 1500);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setView({ kind: "error", message: "无法获取绑定状态" });
        }
      }
    };
    timer = window.setTimeout(poll, 1500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, view]);

  const reauthenticate = async () => {
    setView({ kind: "reauthenticating" });
    sessionStorage.setItem(REOPEN_KEY, "1");
    const callbackURL = window.location.href;
    try {
      const result = await authClient.oauth2.link({
        providerId: "easy-auth",
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      if (result.error) {
        sessionStorage.removeItem(REOPEN_KEY);
        setView({ kind: "error", message: result.error.message ?? "重新认证失败" });
      }
    } catch {
      sessionStorage.removeItem(REOPEN_KEY);
      setView({ kind: "error", message: "无法连接身份服务" });
    }
  };

  const unbind = async () => {
    setView({ kind: "unbinding" });
    try {
      await bindingFetch<{ status: "unbound" }>("/mini-binding/unbind", { method: "POST", body: "{}" });
      setView({ kind: "unbound" });
    } catch (error) {
      if (error instanceof BindingApiError && error.code === "MINI_BINDING_RECENT_AUTH_REQUIRED") {
        setView({ kind: "reauth" });
      } else {
        setView({ kind: "error", message: "暂时无法解除小程序绑定" });
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      createSequence.current += 1;
      setView({ kind: "idle" });
    }
  };

  const terminal =
    view.kind === "confirmed" || view.kind === "rejected" || view.kind === "expired" || view.kind === "replaced" || view.kind === "consumed" || view.kind === "conflict"
      ? terminalCopy(view.kind)
      : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="max-h-[92svh] overflow-auto">
        <SheetHeader>
          <SheetTitle>微信小程序</SheetTitle>
          <SheetDescription>管理当前统一账户的小程序登录凭据。</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-72 flex-col items-center justify-center gap-5 px-6 py-4 text-center">
          {(view.kind === "idle" || view.kind === "loading") && (
            <>
              <Spinner className="size-7" />
              <p className="text-sm text-muted-foreground">正在准备安全绑定请求</p>
            </>
          )}
          {view.kind === "reauth" && (
            <>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
                <RefreshCwIcon className="size-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">需要重新验证身份</h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  为保护登录凭据，请通过统一账户重新认证。授权十分钟内有效。
                </p>
              </div>
              <Button onClick={() => void reauthenticate()}>前往重新认证</Button>
            </>
          )}
          {view.kind === "reauthenticating" && (
            <>
              <Spinner className="size-7" />
              <p className="text-sm text-muted-foreground">正在前往统一账户</p>
            </>
          )}
          {view.kind === "pending" && (
            <>
              <div className="rounded-3xl border bg-white p-3 shadow-sm">
                {view.qrUrl ? (
                  <img src={view.qrUrl} alt="微信小程序绑定二维码" className="size-64 max-w-full" />
                ) : (
                  <div className="flex size-64 items-center justify-center"><Spinner /></div>
                )}
              </div>
              <div className="space-y-1">
                <p className="font-medium">等待小程序确认</p>
                <p className="text-sm text-muted-foreground">
                  二维码将在 {new Date(view.expiresAt).toLocaleTimeString()} 失效
                </p>
              </div>
              <Button variant="outline" onClick={() => void createChallenge()}>
                <QrCodeIcon />生成新二维码
              </Button>
            </>
          )}
          {view.kind === "bound" && (
            <>
              <CheckCircle2Icon className="size-12 text-emerald-600" />
              <div className="space-y-2">
                <h3 className="font-medium">小程序已绑定</h3>
                <p className="max-w-xs text-sm text-muted-foreground">当前微信身份可以登录此统一账户。</p>
              </div>
              <Button variant="destructive" onClick={() => setView({ kind: "confirm-unbind" })}><Link2OffIcon />解除绑定</Button>
            </>
          )}
          {view.kind === "confirm-unbind" && (
            <>
              <AlertCircleIcon className="size-12 text-destructive" />
              <div className="space-y-2">
                <h3 className="font-medium">确认解除绑定</h3>
                <p className="max-w-xs text-sm text-muted-foreground">所有小程序会话将失效；已合并的数据仍保留在当前账户，Web 登录不会退出。</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setView({ kind: "bound" })}>取消</Button>
                <Button variant="destructive" onClick={() => void unbind()}>确认解除</Button>
              </div>
            </>
          )}
          {view.kind === "unbinding" && <><Spinner className="size-7" /><p className="text-sm text-muted-foreground">正在解除绑定</p></>}
          {view.kind === "unbound" && (
            <>
              <CheckCircle2Icon className="size-12 text-muted-foreground" />
              <div className="space-y-2"><h3 className="font-medium">已解除绑定</h3><p className="text-sm text-muted-foreground">小程序会话已撤销，Web 会话保持有效。</p></div>
              <Button variant="outline" onClick={() => void createChallenge()}><QrCodeIcon />生成新的绑定二维码</Button>
            </>
          )}
          {terminal && (
            <>
              <CheckCircle2Icon className="size-12 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="font-medium">{terminal.title}</h3>
                <p className="text-sm text-muted-foreground">{terminal.description}</p>
              </div>
              {view.kind !== "confirmed" && <Button variant="outline" onClick={() => void loadBindingStatus()}>检查当前状态</Button>}
            </>
          )}
          {view.kind === "error" && (
            <>
              <AlertCircleIcon className="size-12 text-destructive" />
              <p className="text-sm text-muted-foreground">{view.message}</p>
              <Button variant="outline" onClick={() => void createChallenge()}>重试</Button>
            </>
          )}
        </div>

        <SheetFooter>
          <p className="text-xs text-muted-foreground">
            二维码仅包含一次性随机请求，不包含账户资料或登录令牌。
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function consumeMiniBindingReopen(): boolean {
  if (typeof window === "undefined" || sessionStorage.getItem(REOPEN_KEY) !== "1") return false;
  sessionStorage.removeItem(REOPEN_KEY);
  return true;
}
