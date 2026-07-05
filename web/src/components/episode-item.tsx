import { Link } from "@tanstack/react-router";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item.tsx";
import { type Episode, EpTypeLabel } from "@/types";

export function EpisodeItem({ episode }: { episode: Episode }) {
  const ep = episode;
  const typeLabel = ep.type !== 0 ? (EpTypeLabel[ep.type as keyof typeof EpTypeLabel] ?? "") : "";

  const meta = [typeLabel, ep.airdate, ep.duration].filter(Boolean);

  return (
    <Item
      variant="outline"
      render={<Link to="/episodes/$episodeId" params={{ episodeId: String(ep.id) }} />}
    >
      <ItemMedia variant="image">
        <span className="font-mono text-muted-foreground">#{ep.sort}</span>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{ep.name_cn || ep.name}</ItemTitle>
        {meta.length > 0 && <ItemDescription>{meta.join(" · ")}</ItemDescription>}
      </ItemContent>
      <ItemActions />
    </Item>
  );
}
