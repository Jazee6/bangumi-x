import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// 分享规范地址，避免把分页、tab 等界面状态带给接收方。
function canonicalUrl() {
  return (
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? window.location.href
  );
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.add({ title: "链接已复制", type: "success" });
  } catch {
    toast.add({ title: "复制失败，请重试。", type: "error", priority: "high" });
  }
}

async function shareDetail(title: string) {
  const url = canonicalUrl();
  if (!navigator.share) {
    await copyLink(url);
    return;
  }

  try {
    await navigator.share({ title, url });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    await copyLink(url);
  }
}

export function DetailShareButton({ title }: { title: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => void shareDetail(title)}>
      <Share2 />
      分享
    </Button>
  );
}
