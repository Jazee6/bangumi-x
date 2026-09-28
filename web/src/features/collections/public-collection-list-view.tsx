import { ListX } from "lucide-react";

import type { PublicCollectionListPage } from "share";

import {
  InfiniteScrollFooter,
  type InfiniteScrollState,
} from "@/components/infinite-scroll-footer";
import { SubjectPosterCard } from "@/components/subject-poster-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
export function PublicCollectionListEmpty() {
  return (
    <Empty variant="outline" className="min-h-72">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ListX />
        </EmptyMedia>
        <EmptyTitle>列表暂时为空</EmptyTitle>
        <EmptyDescription>所有者还没有向这个收藏列表添加条目。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function PublicCollectionListGrid({
  pages,
  state,
}: {
  pages: PublicCollectionListPage[];
  state: InfiniteScrollState;
}) {
  const items = pages.flatMap((page) => page.data);
  if (items.length === 0) return <PublicCollectionListEmpty />;

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {items.map((item) => (
          <div key={item.id} className="min-w-0">
            <SubjectPosterCard id={item.id} title={item.title} imageUrl={item.imageUrl} />
          </div>
        ))}
      </div>
      <InfiniteScrollFooter state={state} />
    </>
  );
}
