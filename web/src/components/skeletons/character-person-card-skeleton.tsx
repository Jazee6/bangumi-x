import { Item, ItemContent, ItemMedia } from "@/components/ui/item.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export function CharacterPersonCardSkeleton() {
  return (
    <Item variant="outline">
      <ItemMedia variant="image">
        <Skeleton className="size-full" />
      </ItemMedia>
      <ItemContent>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </ItemContent>
    </Item>
  );
}
