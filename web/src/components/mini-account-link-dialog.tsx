import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { renderSVG } from "uqr";

import type {
  ApiErrorResponse,
  MiniAccountLinkCredential,
  MiniAccountLinkState,
  MiniAccountLinkWebStatus,
} from "share";

import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { serverUrl } from "@/lib/server-url";

interface MiniAccountLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

class AccountLinkError extends Error {
  constructor(
    message: string,
    readonly code?: ApiErrorResponse["code"],
  ) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as Partial<ApiErrorResponse> | null;
    throw new AccountLinkError(error?.message ?? "关联凭证暂时无法生成，请稍后重试。", error?.code);
  }
  return body as T;
}

function remainingLabel(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function createAccountLink() {
  return fetch(`${serverUrl}/mini/account-links`, { method: "POST", credentials: "include" }).then(
    (response) => readJson<MiniAccountLinkCredential>(response),
  );
}

function getAccountLinkStatus(token: string) {
  return fetch(`${serverUrl}/mini/account-links/web/${encodeURIComponent(token)}`, {
    credentials: "include",
  }).then((response) => readJson<MiniAccountLinkWebStatus>(response));
}

function isTerminal(state: MiniAccountLinkState | undefined) {
  return state === "complete" || state === "failed";
}

export function MiniAccountLinkDialog({ open, onOpenChange }: MiniAccountLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number>(0);
  const [now, setNow] = useState(Date.now());
  const creation = useMutation({
    mutationFn: createAccountLink,
    onSuccess: () => setCopied(false),
  });
  const credential = creation.data ?? null;
  const pending = creation.isPending;
  // 已关联的账号无法再生成凭证，服务端以冲突错误告知。
  const linked =
    creation.error instanceof AccountLinkError &&
    creation.error.code === "MINI_ACCOUNT_LINK_CONFLICT";
  const statusQuery = useQuery({
    queryKey: ["mini-account-link", credential?.token],
    queryFn: () => getAccountLinkStatus(credential?.token ?? ""),
    enabled: open && Boolean(credential),
    refetchInterval: (query) =>
      query.state.status === "error" || isTerminal(query.state.data?.state) ? false : 2000,
    gcTime: 0,
  });
  const status: MiniAccountLinkState = statusQuery.isError
    ? "failed"
    : (statusQuery.data?.state ?? "awaiting_source");
  const error = linked
    ? ""
    : (creation.error?.message ?? (statusQuery.isError ? statusQuery.error.message : ""));

  const { mutate: createCredential } = creation;
  useEffect(() => {
    if (open) createCredential();
  }, [createCredential, open]);

  useEffect(() => {
    if (!open || !credential) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [credential, open]);

  const qrSvg = credential ? renderSVG(credential.qrPayload, { ecc: "M", border: 2 }) : null;
  const qrSource = qrSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`
    : undefined;
  const expired = credential ? Date.parse(credential.expiresAt) <= now : false;

  const copyCode = async () => {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential.shortCode);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 复制失败时保持原样，由用户手动选择配对码
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(openState) => {
        if (!openState) creation.reset();
      }}
      title="关联番迹"
      description={linked ? undefined : "在番迹微信小程序中扫码或输入配对码，再确认用户合并。"}
      className="sm:max-w-sm"
      footer={
        !linked && (status === "awaiting_source" || status === "failed" || expired) ? (
          <Button variant="outline" onClick={() => createCredential()} disabled={pending}>
            {pending ? <Spinner /> : <RefreshCw aria-hidden />}
            重新生成
          </Button>
        ) : undefined
      }
    >
      <div className="flex min-h-72 flex-col items-center justify-center gap-2 py-1">
        {pending && !credential ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Spinner /> 正在生成关联凭证
          </div>
        ) : null}

        {error ? <p className="text-destructive text-center text-sm">{error}</p> : null}

        {linked ? (
          <Empty size="compact">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Link2 aria-hidden />
              </EmptyMedia>
              <EmptyTitle>已关联番迹</EmptyTitle>
              <EmptyDescription>该账号已经关联番迹微信用户。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {credential && status === "awaiting_source" && !expired ? (
          <>
            <p className="text-muted-foreground text-center text-xs">
              {remainingLabel(credential.expiresAt, now)} 后失效
            </p>
            {qrSource ? (
              <img
                className="size-52 bg-white object-contain"
                src={qrSource}
                alt="番迹账号关联二维码"
              />
            ) : null}
            <div className="flex w-full justify-center">
              <div className="relative flex h-9 items-center">
                <code className="text-lg font-semibold tracking-widest">
                  {credential.shortCode}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 left-full"
                  onClick={() => void copyCode()}
                >
                  {copied ? (
                    <Check className="animate-in fade-in zoom-in-95" aria-hidden />
                  ) : (
                    <Copy aria-hidden />
                  )}
                  <span className="sr-only">复制配对码</span>
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {credential && status === "awaiting_confirmation" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Link2 className="size-9" aria-hidden />
            <p className="font-medium">小程序已识别此账号</p>
            <p className="text-muted-foreground text-sm">请回到番迹核对个人数据并确认合并。</p>
          </div>
        ) : null}

        {credential && status === "complete" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Check className="size-9" aria-hidden />
            <p className="font-medium">用户合并已完成</p>
            <p className="text-muted-foreground text-sm">番迹已切换到当前 Bangumi X 用户。</p>
          </div>
        ) : null}

        {credential && (status === "failed" || expired) && !error ? (
          <p className="text-muted-foreground text-center text-sm">关联凭证已失效，请重新生成。</p>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
