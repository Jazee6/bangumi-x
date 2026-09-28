import {
  getBroadcastDisplay,
  type CharacterSummary,
  type PersonSummary,
  type RelatedCharacter,
  type RelatedPerson,
  type RelatedSubject,
  type SubjectBroadcast,
} from "share";

export const DETAIL_STALE_TIME = 60 * 60 * 1_000;
export const CHAPTER_PAGE_SIZE = 50;

export type DetailTarget = "chapter" | "character" | "person" | "subject";

export interface DetailBadge {
  icon?: "score";
  value: string;
}

export interface DetailTab {
  label: string;
  value: string;
}

export interface RelationRowViewModel {
  description: string;
  id: number;
  imageUrl: string;
  key: string;
  name: string;
  target: DetailTarget;
}

export interface RelationGroupViewModel {
  items: RelationRowViewModel[];
  relation: string;
}

export interface SubjectPosterGroupViewModel {
  items: Array<{ id: number; imageUrl: string; key: string; title: string }>;
  relation: string;
}

export function parseDetailId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function getDetailPath(target: DetailTarget, id: number): string {
  const segments: Record<DetailTarget, string> = {
    chapter: "chapters",
    character: "characters",
    person: "persons",
    subject: "subjects",
  };
  return `/pages/${segments[target]}/detail/index?id=${id}`;
}

// 页面栈上限为 10 层，接近上限时详情页之间改为 redirect。
export const MAX_NAVIGATE_DEPTH = 9;

export function openDetail(target: DetailTarget, id: number): void {
  const url = getDetailPath(target, id);
  if (getCurrentPages().length >= MAX_NAVIGATE_DEPTH) {
    wx.redirectTo({ url });
    return;
  }
  wx.navigateTo({ url });
}

export function backFromDetail(): void {
  if (getCurrentPages().length > 1) {
    wx.navigateBack();
    return;
  }
  wx.switchTab({ url: "/pages/discover/index" });
}

export function getLocalDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getBroadcastBadge(
  broadcast: SubjectBroadcast | null,
  today = getLocalDate(),
): string | null {
  return getBroadcastDisplay(broadcast, today)?.detailText ?? null;
}

function joinDescription(values: Array<string | null | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(" · ");
}

export function mapSubjectRelations(
  groups: Array<{ relation: string; items: RelatedSubject[] }>,
): SubjectPosterGroupViewModel[] {
  return groups.map((group) => ({
    relation: group.relation,
    items: group.items.map((subject) => ({
      id: subject.id,
      imageUrl: subject.imageUrl ?? "",
      key: `${subject.id}-${subject.relation}-${subject.chapters ?? ""}`,
      title: subject.title,
    })),
  }));
}

export function mapCharacterRelations(
  groups: Array<{ relation: string; items: CharacterSummary[] }>,
): RelationGroupViewModel[] {
  return groups.map((group) => ({
    relation: group.relation,
    items: group.items.map((character) => ({
      description: joinDescription([
        character.type,
        character.actors.map((actor) => actor.name).join("、"),
      ]),
      id: character.id,
      imageUrl: character.imageUrl ?? "",
      key: `${character.id}-${group.relation}`,
      name: character.name,
      target: "character",
    })),
  }));
}

export function mapPersonRelations(
  groups: Array<{ relation: string; items: PersonSummary[] }>,
): RelationGroupViewModel[] {
  return groups.map((group) => ({
    relation: group.relation,
    items: group.items.map((person) => ({
      description: joinDescription([person.type, person.careers.join("、"), person.chapters]),
      id: person.id,
      imageUrl: person.imageUrl ?? "",
      key: `${person.id}-${group.relation}-${person.chapters ?? ""}`,
      name: person.name,
      target: "person",
    })),
  }));
}

export function mapRelatedCharacters(
  groups: Array<{ relation: string; items: RelatedCharacter[] }>,
): RelationGroupViewModel[] {
  return groups.map((group) => ({
    relation: group.relation,
    items: group.items.map((character) => ({
      description: joinDescription([character.type, character.subject.title]),
      id: character.id,
      imageUrl: character.imageUrl ?? "",
      key: `${character.id}-${character.subject.id}-${character.relation}`,
      name: character.name,
      target: "character",
    })),
  }));
}

export function mapRelatedPersons(
  groups: Array<{ relation: string; items: RelatedPerson[] }>,
): RelationGroupViewModel[] {
  return groups.map((group) => ({
    relation: group.relation,
    items: group.items.map((person) => ({
      description: joinDescription([person.type, person.subject.title]),
      id: person.id,
      imageUrl: person.imageUrl ?? "",
      key: `${person.id}-${person.subject.id}-${person.relation}`,
      name: person.name,
      target: "person",
    })),
  }));
}

interface StickyTabsHost {
  data: { headerHeight: number; tabsStuck: boolean };
  setData(data: { tabsStuck: boolean }): void;
  createIntersectionObserver(
    options: WechatMiniprogram.CreateIntersectionObserverOption,
  ): WechatMiniprogram.IntersectionObserver;
}

const tabObservers = new WeakMap<object, WechatMiniprogram.IntersectionObserver>();

// 标签栏位于 nested-scroll-header 内，Skyline 的 sticky-header 不能用在这里；
// 由哨兵离开顶栏的时机决定是否在顶栏里显示一份标签副本。
export function observeStickyTabs(page: StickyTabsHost): void {
  tabObservers.get(page)?.disconnect();
  const observer = page.createIntersectionObserver({ thresholds: [0, 1] });
  tabObservers.set(page, observer);
  const offset = page.data.headerHeight + 2;
  observer.relativeToViewport({ top: -offset }).observe(".detail-page__tab-sentinel", (result) => {
    // 哨兵从视口底部离开时 Skyline 回调的是全 0 矩形，不能按 top 判定为已吸顶。
    const { height, top } = result.boundingClientRect;
    const stuck = height > 0 && top <= offset;
    if (stuck !== page.data.tabsStuck) page.setData({ tabsStuck: stuck });
  });
}

export function disconnectStickyTabs(page: object): void {
  tabObservers.get(page)?.disconnect();
  tabObservers.delete(page);
}
