import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

async function shareDetail(title: string) {
  if (!navigator.share) {
    toast.add({ title: "当前浏览器不支持系统分享。", type: "error", priority: "high" });
    return;
  }

  try {
    await navigator.share({ title, url: window.location.href });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    toast.add({ title: "分享失败，请重试。", type: "error", priority: "high" });
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
