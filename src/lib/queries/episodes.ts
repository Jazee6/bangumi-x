import { queryOptions } from "@tanstack/react-query";
import { getEpisode } from "@/server/functions";
import type { EpisodeDetail } from "@/types";

const DETAIL_STALE_TIME = 30 * 60 * 1000; // 30 分钟

export const episodeQueryOptions = (id: number) =>
	queryOptions<EpisodeDetail>({
		queryKey: ["episode", id],
		queryFn: () => getEpisode({ data: { id } }),
		staleTime: DETAIL_STALE_TIME,
	});
