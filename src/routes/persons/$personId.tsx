import { createFileRoute, Link } from "@tanstack/react-router";
import { ProxyImage } from "@/components/proxy-image";
import { SubjectCardSkeleton } from "@/components/skeletons/subject-card-skeleton";
import { SubjectCard } from "@/components/subject-card";
import { Badge } from "@/components/ui/badge";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	tabsListVariants,
} from "@/components/ui/tabs";
import { Typography } from "@/components/ui/typography";
import {
	breadcrumbJsonLd,
	personJsonLd,
	relatedSubjectsItemList,
	serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildMeta } from "@/lib/seo/site";
import {
	getPerson,
	getPersonCharacters,
	getPersonSubjects,
} from "@/server/functions";
import {
	BloodTypeLabel,
	CareerLabel,
	type PersonCharacter,
	type PersonDetail,
	type RelatedSubject,
} from "@/types";

interface LoaderData {
	person: PersonDetail;
	subjects: RelatedSubject[];
	characters: PersonCharacter[];
}

const characterRelationOrder = ["主角", "配角", "客串", "其他"];

function getRelationScore(relation: string, order: string[]) {
	const index = order.indexOf(relation);
	return index === -1 ? order.length : index;
}

export const Route = createFileRoute("/persons/$personId")({
	headers: () => ({
		"Cache-Control":
			"public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
	}),
	loader: async ({ params }) => {
		const id = Number(params.personId);
		const [person, subjects, characters] = await Promise.all([
			getPerson({ data: { id } }) as Promise<PersonDetail>,
			getPersonSubjects({ data: { personId: id } }) as Promise<
				RelatedSubject[]
			>,
			getPersonCharacters({ data: { personId: id } }) as Promise<
				PersonCharacter[]
			>,
		]);
		return { person, subjects, characters } satisfies LoaderData;
	},
	head: ({ loaderData, params }) => {
		const data = loaderData as LoaderData | undefined;
		if (!data?.person) {
			return {
				meta: buildMeta({
					title: "人物",
					path: `/persons/${params.personId}`,
				}).meta,
			};
		}
		const { person, subjects } = data;
		const careers = person.career?.map((c) => CareerLabel[c] ?? c).join("、");

		const facts: string[] = [];
		if (careers) facts.push(careers);
		if (person.gender) facts.push(person.gender);
		if (person.birth_year) {
			const m = person.birth_mon ? `${person.birth_mon}月` : "";
			const d = person.birth_day ? `${person.birth_day}日` : "";
			facts.push(`${person.birth_year}年${m}${d}生`);
		}
		const factsLine = facts.length ? `${facts.join(" · ")}。` : "";
		const subjLine = subjects.length
			? `代表作品：${subjects
					.slice(0, 5)
					.map((s) => s.name_cn || s.name)
					.join("、")}。`
			: "";
		const description = `${person.name}。${factsLine}${subjLine}${
			person.summary ?? ""
		}`;

		const image = person.images?.large || person.images?.medium;

		const { meta, links } = buildMeta({
			title: careers ? `${person.name} - ${careers}` : person.name,
			description,
			path: `/persons/${person.id}`,
			ogType: "profile",
			image,
		});

		const itemList = relatedSubjectsItemList(subjects);

		return {
			meta,
			links,
			...serializeJsonLd([
				breadcrumbJsonLd([
					{ name: "首页", path: "/" },
					{ name: "人物", path: "/persons" },
					{ name: person.name, path: `/persons/${person.id}` },
				]),
				personJsonLd(person),
				...(itemList ? [itemList] : []),
			]),
		};
	},
	pendingComponent: () => (
		<div className="max-w-5xl mx-auto">
			<div className="flex flex-col gap-6 sm:flex-row">
				<Skeleton className="aspect-square w-32 shrink-0 self-start rounded-lg" />
				<div className="min-w-0 flex-1 space-y-3">
					<Skeleton className="h-7 w-40" />
					<div className="flex gap-2">
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-6 w-12" />
					</div>
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-4 w-3/4" />
				</div>
			</div>
			<div className="mt-8 space-y-4">
				<div className={tabsListVariants()}>
					<Skeleton className="h-7 w-20 rounded-full" />
					<Skeleton className="h-7 w-20 rounded-full" />
				</div>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{Array.from({ length: 12 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
						<SubjectCardSkeleton key={`card-${i}`} />
					))}
				</div>
			</div>
		</div>
	),
	component: PersonDetailPage,
});

function PersonDetailPage() {
	const { person, subjects, characters } = Route.useLoaderData() as LoaderData;

	const birthday =
		person.birth_year || person.birth_mon || person.birth_day
			? [
					person.birth_year && `${person.birth_year}年`,
					person.birth_mon && `${person.birth_mon}月`,
					person.birth_day && `${person.birth_day}日`,
				]
					.filter(Boolean)
					.join("")
			: null;

	return (
		<article className="max-w-5xl mx-auto">
			{/* Header */}
			<header className="flex flex-col gap-6 sm:flex-row">
				<div className="w-32 shrink-0 self-start">
					<ProxyImage
						src={person.images?.large || person.images?.medium}
						alt={person.name}
						className="aspect-square w-full rounded-lg"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<Typography variant="h1">{person.name}</Typography>
					<div className="mt-3 flex flex-wrap gap-2">
						{person.career?.map((c) => (
							<Badge key={c} variant="secondary">
								{CareerLabel[c] ?? c}
							</Badge>
						))}
						{person.gender && <Badge variant="outline">{person.gender}</Badge>}
						{person.blood_type && (
							<Badge variant="outline">
								血型 {BloodTypeLabel[person.blood_type]}
							</Badge>
						)}
						{birthday && <Badge variant="outline">{birthday}</Badge>}
					</div>
					{person.summary && (
						<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
							{person.summary}
						</p>
					)}
				</div>
			</header>

			{/* Tabs */}
			<section className="mt-8">
				<Tabs defaultValue="subjects">
					<TabsList>
						<TabsTrigger value="subjects">
							相关条目 ({subjects.length})
						</TabsTrigger>
						<TabsTrigger value="characters">
							相关角色 ({characters.length})
						</TabsTrigger>
					</TabsList>

					<TabsContent value="subjects" className="mt-4">
						{subjects.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">
								暂无相关条目
							</p>
						) : (
							<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 list-none p-0 m-0">
								{subjects.map((s) => (
									<li key={`${s.id}-${s.staff}`}>
										<SubjectCard
											id={s.id}
											name={s.name}
											nameCn={s.name_cn}
											image={s.image}
											score={0}
										/>
									</li>
								))}
							</ul>
						)}
					</TabsContent>

					<TabsContent value="characters" className="mt-4">
						{characters.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">
								暂无相关角色
							</p>
						) : (
							<div className="space-y-6">
								{Object.entries(
									characters.reduce<Record<string, typeof characters>>(
										(acc, c) => {
											const key = c.staff || "其他";
											acc[key] ??= [];
											acc[key].push(c);
											return acc;
										},
										{},
									),
								)
									.sort(
										([a], [b]) =>
											getRelationScore(a, characterRelationOrder) -
											getRelationScore(b, characterRelationOrder),
									)
									.map(([relation, items]) => (
										<section key={relation}>
											<Typography variant="h3" className="mb-2">
												{relation}
											</Typography>
											<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
												{items.map((c) => (
													<li key={`${c.id}-${c.subject_id}`}>
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
																<ProxyImage
																	src={c.images?.large || c.images?.medium}
																	alt={c.name}
																/>
															</ItemMedia>
															<ItemContent>
																<ItemTitle>{c.name}</ItemTitle>
																<ItemDescription>
																	{c.subject_name_cn || c.subject_name}
																</ItemDescription>
															</ItemContent>
															<ItemActions />
														</Item>
													</li>
												))}
											</ul>
										</section>
									))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</section>
		</article>
	);
}
