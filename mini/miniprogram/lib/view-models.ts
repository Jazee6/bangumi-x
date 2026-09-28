import type {
  DiscoveryCharacterSummary,
  DiscoveryPersonSummary,
  ScheduleItem,
  SubjectSummary,
} from "share";

import { formatScore } from "./public-pages";

export interface PosterViewModel {
  id: number;
  imageUrl: string;
  rankLabel: string;
  scoreLabel: string;
  title: string;
}

export interface EntityViewModel {
  description: string;
  id: number;
  imageUrl: string;
  name: string;
}

export function toPosterViewModel(item: ScheduleItem | SubjectSummary): PosterViewModel {
  return {
    id: item.id,
    imageUrl: item.imageUrl ?? "",
    rankLabel: "rank" in item && item.rank != null ? `#${item.rank}` : "",
    scoreLabel: formatScore(item.score),
    title: item.title,
  };
}

export function toCharacterViewModel(item: DiscoveryCharacterSummary): EntityViewModel {
  return {
    description: item.type,
    id: item.id,
    imageUrl: item.imageUrl ?? "",
    name: item.name,
  };
}

export function toPersonViewModel(item: DiscoveryPersonSummary): EntityViewModel {
  return {
    description: [item.type, item.careers.join("、")].filter(Boolean).join(" · "),
    id: item.id,
    imageUrl: item.imageUrl ?? "",
    name: item.name,
  };
}
