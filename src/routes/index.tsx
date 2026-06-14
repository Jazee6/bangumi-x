import { createFileRoute } from "@tanstack/react-router";
import { SubjectCardSkeleton } from "@/components/skeletons/subject-card-skeleton";
import { SubjectCard } from "@/components/subject-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	tabsListVariants,
} from "@/components/ui/tabs";
import { Typography } from "@/components/ui/typography";
import { getCalendar } from "@/server/functions";
import type { CalendarDay } from "@/types";

export const Route = createFileRoute("/")({
	loader: async () => getCalendar(),
	pendingComponent: () => (
		<div>
			<Skeleton className="mb-4 h-8 w-32" />
			<div className={`${tabsListVariants()} mb-4 max-w-full overflow-x-auto`}>
				{Array.from({ length: 7 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					<Skeleton key={`tab-${i}`} className="h-7 w-12 rounded-full" />
				))}
			</div>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: 12 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					<SubjectCardSkeleton key={`card-${i}`} />
				))}
			</div>
		</div>
	),
	component: HomePage,
});

function HomePage() {
	const calendar = Route.useLoaderData() as CalendarDay[];

	// Today's weekday ID (JS: 0=Sunday, API: 1=Monday..7=Sunday)
	const todayJsDay = new Date().getDay();
	const todayApiId = todayJsDay === 0 ? 7 : todayJsDay;
	const todayTab = String(todayApiId);

	return (
		<div>
			<Typography variant="h1" className="mb-4">
				每日放送
			</Typography>
			<Tabs defaultValue={todayTab} className="w-full">
				<TabsList className="mb-4 max-w-full overflow-x-auto">
					{calendar.map((day) => (
						<TabsTrigger key={day.weekday.id} value={String(day.weekday.id)}>
							{day.weekday.cn}
						</TabsTrigger>
					))}
				</TabsList>
				{calendar.map((day) => (
					<TabsContent
						key={day.weekday.id}
						value={String(day.weekday.id)}
						className="mt-0"
					>
						{day.items.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground">
								今日无放送
							</p>
						) : (
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{day.items.map((item) => (
									<SubjectCard
										key={item.id}
										id={item.id}
										name={item.name}
										nameCn={item.name_cn}
										image={item.images?.large || item.images?.common}
										score={item.rating?.score ?? 0}
									/>
								))}
							</div>
						)}
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
