import { ImageOff, Search } from "lucide-react";

import { EntityGridSkeleton, PosterGridSkeleton } from "@/components/content-skeletons";
import { ErrorEmpty } from "@/components/error-empty";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function DiscoveryLoading({ entity = false }: { entity?: boolean }) {
  return entity ? (
    <EntityGridSkeleton count={12} className="mt-4" />
  ) : (
    <PosterGridSkeleton count={24} className="mt-4" />
  );
}

const EMPTY_CONTENT = {
  unsearched: {
    title: "输入关键词开始搜索",
    description: "提交关键词后即可查看匹配结果。",
  },
  "no-results": {
    title: "没有找到匹配结果",
    description: "可以尝试其他关键词。",
  },
  popular: {
    title: "暂无本年度热门条目",
    description: "可以切换其他条目类型继续浏览。",
  },
} as const;

export function DiscoveryEmpty({ kind = "popular" }: { kind?: keyof typeof EMPTY_CONTENT }) {
  const content = EMPTY_CONTENT[kind];
  return (
    <Empty variant="outline" className="mt-6 min-h-72">
      <EmptyHeader>
        <EmptyMedia variant="icon">{kind === "popular" ? <ImageOff /> : <Search />}</EmptyMedia>
        <EmptyTitle>{content.title}</EmptyTitle>
        <EmptyDescription>{content.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function DiscoveryError({
  message,
  retrying,
  onRetry,
  title = "发现内容加载失败",
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
  title?: string;
}) {
  return <ErrorEmpty title={title} message={message} retrying={retrying} onRetry={onRetry} />;
}
