import { Link } from "@tanstack/react-router";
import { ListVideo } from "lucide-react";

import { ChapterListSkeleton } from "@/components/content-skeletons";
import { ErrorEmpty } from "@/components/error-empty";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { ChapterListQuery } from "@/features/chapters/chapter-query";

export function ChapterList({ query }: { query: ChapterListQuery }) {
  const chapters = query.data?.pages.flatMap((page) => page.data);

  return (
    <>
      {query.isPending && <ChapterListLoading />}
      {query.isError && !query.data && (
        <ChapterListError
          message={query.error.message}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      )}
      {chapters?.length === 0 && <ChapterListEmpty />}
      {chapters && chapters.length > 0 && (
        <ol className="space-y-3">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <Item
                variant="outline"
                render={
                  <Link to="/chapters/$chapterId" params={{ chapterId: chapter.id.toString() }} />
                }
              >
                <ItemContent>
                  <ItemDescription variant="metadata">
                    {chapter.type}
                    {chapter.sequence !== null && ` #${chapter.sequence}`}
                  </ItemDescription>
                  <ItemTitle>{chapter.title}</ItemTitle>
                </ItemContent>
                {(chapter.date || chapter.duration) && (
                  <ItemActions variant="metadata">
                    {chapter.date && <span>{chapter.date}</span>}
                    {chapter.duration && <span>{chapter.duration}</span>}
                  </ItemActions>
                )}
              </Item>
            </li>
          ))}
        </ol>
      )}

      <InfiniteScrollFooter state={query} loadingLabel="正在加载更多章节" />
    </>
  );
}

function ChapterListLoading() {
  return <ChapterListSkeleton />;
}

function ChapterListError({
  message,
  retrying,
  onRetry,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <ErrorEmpty
      title="章节加载失败"
      message={message}
      retrying={retrying}
      onRetry={onRetry}
      className="mt-0 min-h-48"
    />
  );
}

function ChapterListEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ListVideo />
        </EmptyMedia>
        <EmptyTitle>暂无章节</EmptyTitle>
        <EmptyDescription>这个条目还没有可浏览的章节。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
