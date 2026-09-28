import { Link } from "@tanstack/react-router";

import type { ChapterDetail } from "share";

import { HeaderTitle } from "@/components/app-shell";
import { CrawlNavigation } from "@/components/crawl-navigation";
import { DetailField } from "@/components/detail-field";
import { DetailShareButton } from "@/components/detail-share-button";
import { SummaryEmpty } from "@/components/empty-states";
import { Button } from "@/components/ui/button";

export function ChapterView({ chapter }: { chapter: ChapterDetail }) {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <article>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>{chapter.type}</span>
          {chapter.sequence !== null && <span>#{chapter.sequence}</span>}
        </div>
        <HeaderTitle className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {chapter.title}
        </HeaderTitle>

        {(chapter.date || chapter.duration) && (
          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {chapter.date && <DetailField label="日期" value={chapter.date} />}
            {chapter.duration && <DetailField label="时长" value={chapter.duration} />}
          </dl>
        )}

        <section className="mt-6">
          <h2 className="text-lg font-semibold">所属条目</h2>
          <Button
            className="mt-3"
            variant="outline"
            nativeButton={false}
            render={
              <Link
                to="/subjects/$subjectId"
                params={{ subjectId: chapter.subject.id.toString() }}
              />
            }
          >
            {chapter.subject.title}
          </Button>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">简介</h2>
          <div className="text-muted-foreground mt-3 leading-7">
            {chapter.summary ? (
              <p className="whitespace-pre-line">{chapter.summary}</p>
            ) : (
              <SummaryEmpty />
            )}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <DetailShareButton title={chapter.title} />
        </div>

        <CrawlNavigation aria-label="章节导航" className="mt-8 border-t pt-4 text-sm">
          <Link
            to="/subjects/$subjectId"
            params={{ subjectId: chapter.subject.id.toString() }}
            className="text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            返回全部章节
          </Link>
        </CrawlNavigation>
      </article>
    </div>
  );
}
