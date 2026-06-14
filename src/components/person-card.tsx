import { Link } from "@tanstack/react-router";
import { ProxyImage } from "@/components/proxy-image";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";

interface PersonCardProps {
	id: number;
	name: string;
	image: string | undefined;
	to: "/characters/$characterId" | "/persons/$personId";
	subtitle?: string;
}

export function PersonCard({ id, name, image, to, subtitle }: PersonCardProps) {
	const params =
		to === "/characters/$characterId"
			? { characterId: String(id) }
			: { personId: String(id) };

	return (
		<Item variant="outline" render={<Link to={to} params={params} />}>
			<ItemMedia variant="image">
				<ProxyImage src={image} alt={name} />
			</ItemMedia>
			<ItemContent>
				<ItemTitle>{name}</ItemTitle>
				{subtitle && <ItemDescription>{subtitle}</ItemDescription>}
			</ItemContent>
			<ItemActions />
		</Item>
	);
}
