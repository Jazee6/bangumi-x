import { createFileRoute } from "@tanstack/react-router";
import { SubjectCard } from "@/components/subject-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCalendar } from "@/server/functions";
import type { CalendarDay } from "@/types";

export const Route = createFileRoute("/")({
	loader: async () => getCalendar(),
	pendingComponent: () => (
		<div>
			<Skeleton className="mb-4 h-8 w-32" />
			<div className="mb-4 flex gap-2">
				{Array.from({ length: 7 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					<Skeleton key={`tab-${i}`} className="h-9 w-16" />
				))}
			</div>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: 6 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					<div key={`card-${i}`}>
						<Skeleton className="aspect-3/4 rounded-lg" />
						<Skeleton className="mt-2 h-4 w-3/4" />
					</div>
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
			<h1 className="mb-4 text-2xl font-bold">每日放送</h1>
			<Tabs defaultValue={todayTab}>
				<TabsList className="mb-4">
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
