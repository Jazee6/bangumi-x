import { Link } from "@tanstack/react-router";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { ProxyImage } from "@/components/proxy-image";
import type { RelatedCharacter } from "@/types";

export function CharacterItem({ character }: { character: RelatedCharacter }) {
	const c = character;
	const image = c.images?.large || c.images?.medium;

	return (
		<Item
			variant="outline"
			render={
				<Link
					to="/characters/$characterId"
					params={{ characterId: String(c.id) }}
				/>
			}
		>
			<ItemMedia variant="image">
				<ProxyImage src={image} alt={c.name} />
			</ItemMedia>
			<ItemContent>
				<ItemTitle>{c.name}</ItemTitle>
				{c.actors.length > 0 && (
					<ItemDescription>
						{c.actors.map((a) => a.name).join("、")}
					</ItemDescription>
				)}
			</ItemContent>
			<ItemActions />
		</Item>
	);
}
