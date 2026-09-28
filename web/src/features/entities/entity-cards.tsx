import { Link } from "@tanstack/react-router";

import { EntityImage } from "@/components/entity-image";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

export const entityDetails = (...parts: Array<string | null | false | undefined>) =>
  parts.filter(Boolean).join(" · ");

interface EntityCardProps {
  imageUrl: string | null;
  title: string;
  description: string;
  link: React.ReactElement<typeof Link>;
  singleLineDescription?: boolean;
}

export function EntityCard({
  imageUrl,
  title,
  description,
  link,
  singleLineDescription = false,
}: EntityCardProps) {
  return (
    <Item variant="outline" alignment="start" render={link}>
      <ItemMedia variant="image">
        <EntityImage
          key={imageUrl}
          src={imageUrl}
          alt={`${title}图片`}
          className="object-top"
          iconClassName="size-5"
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription variant={singleLineDescription ? "single-line" : "default"}>
          {description}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
