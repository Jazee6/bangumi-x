import { ExternalLink } from "lucide-react";

import type { SubjectDetail } from "share";

import { HeaderTitle } from "@/components/app-shell";

import { DetailField } from "@/components/detail-field";
import { DetailShareButton } from "@/components/detail-share-button";
import { EntityImage } from "@/components/entity-image";
import { SummaryEmpty } from "@/components/empty-states";
import { CollapsibleSummary } from "@/features/subjects/collapsible-summary";
import { getBroadcastDisplay } from "share";
import { useLocalDate } from "@/features/broadcast/use-local-date";
import { SubjectCollectionControl } from "@/features/collections/subject-collection-control";
import { SubjectDetailProgressControl } from "@/features/progress/subject-progress-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SubjectView({
  subject,
  children,
  openCollection = false,
  onCollectionIntentConsumed,
}: {
  subject: SubjectDetail;
  children?: React.ReactNode;
  openCollection?: boolean;
  onCollectionIntentConsumed?: () => void;
}) {
  const today = useLocalDate();
  const broadcast = getBroadcastDisplay(subject.broadcast, today);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <article className="grid gap-6 sm:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
        <div className="bg-muted aspect-[2/3] w-full max-w-64 overflow-hidden rounded-xl">
          <EntityImage
            key={subject.imageUrl}
            src={subject.imageUrl}
            alt={`${subject.title}封面`}
            iconClassName="size-10"
            priority
          />
        </div>

        <div className="min-w-0">
          <header>
            <HeaderTitle className="text-3xl font-semibold tracking-tight md:text-4xl">
              {subject.title}
            </HeaderTitle>
            {subject.originalTitle && (
              <p className="text-muted-foreground mt-2 text-base">{subject.originalTitle}</p>
            )}
          </header>

          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {subject.score !== null && (
              <DetailField label="评分" value={subject.score.toFixed(1)} />
            )}
            {subject.rank !== null && <DetailField label="排名" value={`#${subject.rank}`} />}
            {broadcast && (
              <DetailField
                label="放送"
                value={broadcast.detailText}
                title={broadcast.date}
                ariaLabel={`${broadcast.detailText}，日期 ${broadcast.date}`}
              />
            )}
            {subject.date && <DetailField label="日期" value={subject.date} />}
            {subject.platform && <DetailField label="平台" value={subject.platform} />}
          </dl>

          <section className="text-muted-foreground mt-6 leading-7">
            {subject.summary ? <CollapsibleSummary text={subject.summary} /> : <SummaryEmpty />}
          </section>

          {(subject.nsfw || subject.tags.length > 0) && (
            <section className="mt-6">
              <ul className="flex flex-wrap gap-2">
                {subject.nsfw && (
                  <li>
                    <Badge variant="destructive">NSFW</Badge>
                  </li>
                )}
                {subject.tags.map((tag) => (
                  <li key={tag}>
                    <Badge variant="secondary">{tag}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <SubjectCollectionControl
              subjectId={subject.id}
              openAfterLogin={openCollection}
              onIntentConsumed={onCollectionIntentConsumed}
            />
            <SubjectDetailProgressControl
              subjectId={subject.id}
              title={subject.title}
              type={subject.type}
              totalChapters={subject.totalChapters}
            />
            <DetailShareButton title={subject.title} />
            {subject.type === "动画" && (
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <a
                    href={`https://mikanani.kas.pub/Home/Search?searchstr=${encodeURIComponent(subject.title)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  />
                }
              >
                <ExternalLink />
                前往 Mikan
              </Button>
            )}
          </div>
        </div>
      </article>
      {children}
    </div>
  );
}
