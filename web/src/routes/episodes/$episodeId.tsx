import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Typography } from "@/components/ui/typography.tsx";
import { buildMeta } from "@/lib/seo/site.ts";
import { getEpisode, getSubject } from "@/server/functions.ts";
import { type EpisodeDetail, EpTypeLabel, type Subject } from "@/types";

interface LoaderData {
  episode: EpisodeDetail | null;
  subject: Subject | null;
}

export const Route = createFileRoute("/episodes/$episodeId")({
  headers: () => ({
    "Cache-Control": "public, max-age=300, s-maxage=14400, stale-while-revalidate=86400",
  }),
  loader: async ({ params }): Promise<LoaderData> => {
    const id = Number(params.episodeId);
    const episode = await getEpisode({ data: { id } });
    if (!episode) {
      return { episode, subject: null };
    }
    let subject: Subject | null;
    try {
      subject = await getSubject({ data: { id: episode.subject_id } });
    } catch {
      subject = null;
    }
    return { episode, subject };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.episode) {
      return {
        meta: buildMeta({
          title: "章节",
        }),
      };
    }
    const { episode, subject } = loaderData;
    const epName = episode.name_cn || episode.name || `第 ${episode.sort} 话`;
    const seriesName = subject?.name_cn || subject?.name;
    const title = seriesName
      ? `${seriesName} 第 ${episode.sort} 话 ${epName}`
      : `第 ${episode.sort} 话 ${epName}`;

    const facts: string[] = [];
    if (episode.airdate) facts.push(`首播 ${episode.airdate}`);
    if (episode.duration) facts.push(`时长 ${episode.duration}`);
    const factsLine = facts.length ? `${facts.join(" · ")}。` : "";
    const description = `${title}。${factsLine}${episode.desc ?? ""}`;

    return {
      meta: buildMeta({
        title,
        description,
      }),
    };
  },
  pendingComponent: () => (
    <div className="max-w-5xl mx-auto">
      <Skeleton className="mb-4 h-8 w-24" />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="mt-6 space-y-2">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  ),
  component: EpisodeDetailPage,
});

function EpisodeDetailPage() {
  const { episode } = Route.useLoaderData();
  if (!episode) return null;

  return (
    <article className="max-w-5xl mx-auto">
      <nav aria-label="返回">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          nativeButton={false}
          render={
            <Link to="/subjects/$subjectId" params={{ subjectId: String(episode.subject_id) }} />
          }
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          返回
        </Button>
      </nav>

      <header>
        <Typography variant="h1">
          #{episode.sort} {episode.name_cn || episode.name}
        </Typography>
        {episode.name_cn && episode.name !== episode.name_cn && (
          <p className="mt-1 text-muted-foreground">{episode.name}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {episode.type !== 0 && (
            <Badge variant="secondary">
              {EpTypeLabel[episode.type as keyof typeof EpTypeLabel] ?? `类型${episode.type}`}
            </Badge>
          )}
          {episode.airdate && <Badge variant="outline">{episode.airdate}</Badge>}
          {episode.duration && <Badge variant="outline">{episode.duration}</Badge>}
          {episode.disc > 0 && <Badge variant="outline">Disc {episode.disc}</Badge>}
        </div>
      </header>

      {episode.desc && (
        <section className="mt-6">
          <Typography variant="h2" className="mb-2">
            简介
          </Typography>
          <p className="leading-relaxed text-muted-foreground">{episode.desc}</p>
        </section>
      )}
    </article>
  );
}
