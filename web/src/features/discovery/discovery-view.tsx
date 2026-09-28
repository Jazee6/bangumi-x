import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Clapperboard,
  Gamepad2,
  Music,
  Shapes,
  Tv,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { CharacterPage, PersonPage, SubjectPage, SubjectTypeFilter } from "share";

import {
  InfiniteScrollFooter,
  type InfiniteScrollState,
} from "@/components/infinite-scroll-footer";
import { SubjectPosterCard } from "@/components/subject-poster-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DiscoverTab } from "@/features/discovery/discovery-search";
import { DiscoveryEmpty } from "@/features/discovery/discovery-states";
import { EntityCard, entityDetails } from "@/features/entities/entity-cards";

const SUBJECT_TYPES: Array<{
  value: SubjectTypeFilter;
  label: string;
  icon: typeof Clapperboard;
}> = [
  { value: "anime", label: "动画", icon: Clapperboard },
  { value: "book", label: "书籍", icon: BookOpen },
  { value: "game", label: "游戏", icon: Gamepad2 },
  { value: "music", label: "音乐", icon: Music },
  { value: "real", label: "三次元", icon: Tv },
];

function SubjectTypeLabel({ type }: { type: SubjectTypeFilter }) {
  const subjectType = SUBJECT_TYPES.find(({ value }) => value === type);
  if (!subjectType) return null;

  const Icon = subjectType.icon;
  return (
    <span className="flex items-center gap-2">
      <Icon />
      {subjectType.label}
    </span>
  );
}

export function DiscoveryControls({
  tab,
  type,
  onTabChange,
  onTypeChange,
}: {
  tab: DiscoverTab;
  type: SubjectTypeFilter;
  onTabChange: (tab: DiscoverTab) => void;
  onTypeChange: (type: SubjectTypeFilter) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 overflow-x-auto pb-1">
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as DiscoverTab)}>
        <TabsList>
          <TabsTrigger value="subjects">
            <Shapes />
            条目
          </TabsTrigger>
          <TabsTrigger value="characters">
            <UsersRound />
            角色
          </TabsTrigger>
          <TabsTrigger value="persons">
            <UserRound />
            人物
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "subjects" && (
        <Select
          items={SUBJECT_TYPES}
          value={type}
          onValueChange={(value) => onTypeChange(value as SubjectTypeFilter)}
        >
          <SelectTrigger aria-label="条目类型" className="shrink-0">
            <SelectValue>
              <SubjectTypeLabel type={type} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {SUBJECT_TYPES.map(({ value }) => (
              <SelectItem key={value} value={value}>
                <SubjectTypeLabel type={value} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function DiscoverySubjects({
  pages,
  state,
  searched,
}: {
  pages: SubjectPage[];
  state: InfiniteScrollState;
  searched: boolean;
}) {
  const subjects = pages.flatMap((page) => page.data);
  if (subjects.length === 0) {
    return <DiscoveryEmpty kind={searched ? "no-results" : "popular"} />;
  }

  return (
    <DiscoveryCollection state={state}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {subjects.map((subject) => (
          <SubjectPosterCard
            key={subject.id}
            id={subject.id}
            title={subject.title}
            imageUrl={subject.imageUrl}
            score={subject.score}
          />
        ))}
      </div>
    </DiscoveryCollection>
  );
}

export function DiscoveryCharacters({
  pages,
  state,
}: {
  pages: CharacterPage[];
  state: InfiniteScrollState;
}) {
  return <DiscoveryEntities pages={pages} state={state} entity="character" />;
}

export function DiscoveryPersons({
  pages,
  state,
}: {
  pages: PersonPage[];
  state: InfiniteScrollState;
}) {
  return <DiscoveryEntities pages={pages} state={state} entity="person" />;
}

function DiscoveryEntities({
  pages,
  state,
  entity,
}: {
  pages: Array<CharacterPage | PersonPage>;
  state: InfiniteScrollState;
  entity: "character" | "person";
}) {
  const items: Array<CharacterPage["data"][number] | PersonPage["data"][number]> = pages.flatMap(
    (page) => page.data as Array<CharacterPage["data"][number] | PersonPage["data"][number]>,
  );
  if (items.length === 0) return <DiscoveryEmpty kind="no-results" />;

  return (
    <DiscoveryCollection state={state}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const careers = "careers" in item ? item.careers.join("、") : null;
          return (
            <EntityCard
              key={item.id}
              imageUrl={item.imageUrl}
              title={item.name}
              description={entityDetails(item.type, careers)}
              link={
                entity === "character" ? (
                  <Link
                    to="/characters/$characterId"
                    params={{ characterId: item.id.toString() }}
                    search={{ tab: "subjects" }}
                  />
                ) : (
                  <Link
                    to="/persons/$personId"
                    params={{ personId: item.id.toString() }}
                    search={{ tab: "subjects" }}
                  />
                )
              }
            />
          );
        })}
      </div>
    </DiscoveryCollection>
  );
}

function DiscoveryCollection({
  state,
  children,
}: {
  state: InfiniteScrollState;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      {children}
      <InfiniteScrollFooter state={state} />
    </div>
  );
}
