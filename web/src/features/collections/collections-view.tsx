import { Link } from "@tanstack/react-router";
import { BookmarkX } from "lucide-react";

import type { CollectionPage } from "share";

import { PosterGridSkeleton } from "@/components/content-skeletons";
import { ErrorEmpty } from "@/components/error-empty";
import {
  InfiniteScrollFooter,
  type InfiniteScrollState,
} from "@/components/infinite-scroll-footer";
import { SubjectPosterCard } from "@/components/subject-poster-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
export function CollectionsLoading() {
  return (
    <div aria-busy="true">
      <PosterGridSkeleton count={24} className="mt-4" />
    </div>
  );
}

export function CollectionsError({
  message,
  retrying,
  onRetry,
  title = "个人记录加载失败",
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
  title?: string;
}) {
  return <ErrorEmpty title={title} message={message} retrying={retrying} onRetry={onRetry} />;
}

export function CollectionsEmpty({ filtered }: { filtered: boolean }) {
  const content = filtered
    ? { title: "没有匹配结果", description: "调整筛选或搜索条件后再试。" }
    : { title: "暂无收藏", description: "你还没有收藏任何条目。" };
  return (
    <Empty variant="outline" className="mt-6 min-h-72">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookmarkX />
        </EmptyMedia>
        <EmptyTitle>{content.title}</EmptyTitle>
        <EmptyDescription>{content.description}</EmptyDescription>
      </EmptyHeader>
      {!filtered && (
        <EmptyContent>
          <Button
            nativeButton={false}
            render={<Link to="/discover" search={{ tab: "subjects", type: "anime" }} />}
          >
            去发现条目
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

export function PersonalRecordsGrid({
  pages,
  filtered,
  state,
}: {
  pages: CollectionPage[];
  filtered: boolean;
  state: InfiniteScrollState;
}) {
  const items = pages.flatMap((page) => page.data);
  if (items.length === 0) return <CollectionsEmpty filtered={filtered} />;
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {items.map((item) => (
          <SubjectPosterCard
            key={item.id}
            id={item.id}
            title={item.title}
            imageUrl={item.imageUrl}
          />
        ))}
      </div>
      <InfiniteScrollFooter state={state} />
    </div>
  );
}
