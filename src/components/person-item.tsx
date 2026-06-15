import { Link } from "@tanstack/react-router";
import { ProxyImage } from "@/components/proxy-image";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import type { RelatedPerson } from "@/types";

export function PersonItem({ person }: { person: RelatedPerson }) {
	const p = person;
	const image = p.images?.large || p.images?.medium;

	return (
		<Item
			variant="outline"
			render={
				<Link to="/persons/$personId" params={{ personId: String(p.id) }} />
			}
		>
			<ItemMedia variant="image">
				<ProxyImage src={image} alt={p.name} />
			</ItemMedia>
			<ItemContent>
				<ItemTitle>{p.name}</ItemTitle>
				{/*{p.eps && <ItemDescription>{p.eps}</ItemDescription>}*/}
			</ItemContent>
			<ItemActions />
		</Item>
	);
}
