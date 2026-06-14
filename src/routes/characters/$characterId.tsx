import { createFileRoute } from "@tanstack/react-router";
import { PersonCard } from "@/components/person-card";
import { ProxyImage } from "@/components/proxy-image";
import { SubjectCardSkeleton } from "@/components/skeletons/subject-card-skeleton";
import { SubjectCard } from "@/components/subject-card";
import { Badge } from "@/components/ui/badge";
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
	getCharacter,
	getCharacterPersons,
	getCharacterSubjects,
} from "@/server/functions";
import {
	BloodTypeLabel,
	type Character,
	type CharacterPerson,
	CharacterTypeLabel,
	type RelatedSubject,
} from "@/types";

interface LoaderData {
	character: Character;
	subjects: RelatedSubject[];
	persons: CharacterPerson[];
}

export const Route = createFileRoute("/characters/$characterId")({
	loader: async ({ params }) => {
		const id = Number(params.characterId);
		const [character, subjects, persons] = await Promise.all([
			getCharacter({ data: { id } }) as Promise<Character>,
			getCharacterSubjects({ data: { characterId: id } }) as Promise<
				RelatedSubject[]
			>,
			getCharacterPersons({ data: { characterId: id } }) as Promise<
				CharacterPerson[]
			>,
		]);
		return { character, subjects, persons } satisfies LoaderData;
	},
	pendingComponent: () => (
		<div className="max-w-5xl mx-auto">
			<div className="flex flex-col gap-6 sm:flex-row">
				<Skeleton className="aspect-square w-32 shrink-0 self-start rounded-lg" />
				<div className="min-w-0 flex-1 space-y-3">
					<Skeleton className="h-7 w-40" />
					<div className="flex gap-2">
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-6 w-12" />
						<Skeleton className="h-6 w-20" />
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
	component: CharacterDetailPage,
});

function CharacterDetailPage() {
	const { character, subjects, persons } = Route.useLoaderData() as LoaderData;

	const birthday =
		character.birth_year || character.birth_mon || character.birth_day
			? [
					character.birth_year && `${character.birth_year}年`,
					character.birth_mon && `${character.birth_mon}月`,
					character.birth_day && `${character.birth_day}日`,
				]
					.filter(Boolean)
					.join("")
			: null;

	return (
		<div className="max-w-5xl mx-auto">
			{/* Header */}
			<div className="flex flex-col gap-6 sm:flex-row">
				<div className="w-32 shrink-0 self-start">
					<ProxyImage
						src={character.images?.large || character.images?.medium}
						alt={character.name}
						className="aspect-square w-full rounded-lg"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<Typography variant="h1">{character.name}</Typography>
					<div className="mt-3 flex flex-wrap gap-2">
						{character.type && (
							<Badge variant="secondary">
								{CharacterTypeLabel[character.type] ?? ""}
							</Badge>
						)}
						{character.gender && (
							<Badge variant="outline">{character.gender}</Badge>
						)}
						{character.blood_type && (
							<Badge variant="outline">
								血型 {BloodTypeLabel[character.blood_type]}
							</Badge>
						)}
						{birthday && <Badge variant="outline">{birthday}</Badge>}
					</div>
					{character.summary && (
						<p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
							{character.summary}
						</p>
					)}
				</div>
			</div>

			{/* Tabs */}
			<div className="mt-8">
				<Tabs defaultValue="subjects">
					<TabsList>
						<TabsTrigger value="subjects">
							相关条目 ({subjects.length})
						</TabsTrigger>
						<TabsTrigger value="persons">
							相关人物 ({persons.length})
						</TabsTrigger>
					</TabsList>

					<TabsContent value="subjects" className="mt-4">
						{subjects.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">
								暂无相关条目
							</p>
						) : (
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{subjects.map((s) => (
									<SubjectCard
										key={s.id}
										id={s.id}
										name={s.name}
										nameCn={s.name_cn}
										image={s.image}
										score={0}
									/>
								))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="persons" className="mt-4">
						{persons.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">
								暂无相关人物
							</p>
						) : (
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{persons.map((p) => (
									<PersonCard
										key={p.id}
										id={p.id}
										name={p.name}
										image={p.images?.large || p.images?.medium}
										to="/persons/$personId"
										subtitle={p.staff || p.subject_name_cn || p.subject_name}
									/>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
