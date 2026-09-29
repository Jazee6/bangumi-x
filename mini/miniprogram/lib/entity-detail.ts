import type {
  CharacterDetail,
  PersonDetail,
  RelatedCharacter,
  RelatedPerson,
  RelatedSubjectsResponse,
} from "share";

import {
  DETAIL_STALE_TIME,
  backFromDetail,
  disconnectStickyTabs,
  mapRelatedCharacters,
  mapRelatedPersons,
  mapSubjectRelations,
  observeStickyTabs,
  parseDetailId,
  type DetailBadge,
  type DetailTab,
  type RelationGroupViewModel,
  type SubjectPosterGroupViewModel,
} from "./detail-pages";
import { publicPageCache } from "./memory-cache";
import { detailShare } from "./public-sharing";
import { getErrorMessage, requestJson } from "./request";

// 角色与人物的详情页只在名词和互相关联的方向上不同，与 web 的 ENTITY_KINDS 对应。
export const ENTITY_DETAIL_KINDS = {
  character: {
    collection: "characters",
    label: "角色",
    relatedTab: "persons",
    relatedLabel: "人物",
    mapRelated: (groups: Array<{ relation: string; items: RelatedPerson[] }>) =>
      mapRelatedPersons(groups),
  },
  person: {
    collection: "persons",
    label: "人物",
    relatedTab: "characters",
    relatedLabel: "角色",
    mapRelated: (groups: Array<{ relation: string; items: RelatedCharacter[] }>) =>
      mapRelatedCharacters(groups),
  },
} as const;

export type EntityDetailKind = keyof typeof ENTITY_DETAIL_KINDS;

type EntityDetail = CharacterDetail | PersonDetail;
type RelatedResponse = {
  total: number;
  groups: Array<{ relation: string; items: Array<RelatedCharacter & RelatedPerson> }>;
};

export function getEntityTabs(kind: EntityDetailKind): DetailTab[] {
  const config = ENTITY_DETAIL_KINDS[kind];
  return [
    { label: "条目", value: "subjects" },
    { label: config.relatedLabel, value: config.relatedTab },
  ];
}

export function getEntityBadges(detail: EntityDetail): DetailBadge[] {
  const careers = "careers" in detail ? detail.careers.join("、") : "";
  return [detail.type, careers, detail.gender, detail.birthday, detail.bloodType]
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value }));
}

export function registerEntityDetailPage(kind: EntityDetailKind): void {
  const config = ENTITY_DETAIL_KINDS[kind];
  const path = (id: number, suffix = "") => `/${config.collection}/${id}${suffix}`;
  const cacheKey = (id: number, suffix = "") => `${kind}:${id}${suffix}`;

  Page({
    data: {
      badges: [] as DetailBadge[],
      entityId: 0,
      errorMessage: "",
      headerHeight: 0,
      heroTitleHidden: false,
      imageUrl: "",
      kindLabel: config.label,
      loaded: false,
      loading: true,
      panelSkeletonRows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      related: [] as RelationGroupViewModel[],
      relatedError: "",
      relatedLabel: config.relatedLabel,
      relatedLoaded: false,
      relatedLoading: false,
      subjects: [] as SubjectPosterGroupViewModel[],
      subjectsError: "",
      subjectsLoaded: false,
      subjectsLoading: false,
      summary: "",
      tab: "subjects",
      tabIndex: 0,
      tabs: getEntityTabs(kind),
      tabsStuck: false,
      title: "",
    },

    onLoad(options: Record<string, string | undefined>) {
      const entityId = parseDetailId(options.id);
      if (!entityId) {
        this.setData({ errorMessage: `${config.label} ID 无效。`, loading: false });
        return;
      }
      this.setData({ entityId });
      void this.loadEntity();
    },

    onUnload() {
      disconnectStickyTabs(this);
    },

    onBack() {
      backFromDetail();
    },

    onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
      this.setData({ headerHeight: event.detail.height }, () => {
        if (this.data.loaded) observeStickyTabs(this);
      });
    },

    onHeroMediaLayoutChange() {
      if (this.data.loaded) observeStickyTabs(this);
    },

    onTitleVisibilityChange(event: WechatMiniprogram.CustomEvent<{ hidden: boolean }>) {
      this.setData({ heroTitleHidden: event.detail.hidden });
    },

    onTabChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      this.selectTab(event.detail.value === "subjects" ? 0 : 1);
    },

    onSwiperChange(event: WechatMiniprogram.CustomEvent<{ current: number }>) {
      if (event.detail.current !== this.data.tabIndex) this.selectTab(event.detail.current);
    },

    selectTab(tabIndex: number) {
      this.setData({ tab: this.data.tabs[tabIndex]?.value ?? "subjects", tabIndex });
      void this.loadTab(tabIndex);
    },

    onRetry() {
      void this.loadEntity();
    },

    onRetryPanel() {
      void this.loadTab(this.data.tabIndex, true);
    },

    onShareAppMessage() {
      return detailShare(kind, this.data.entityId, this.data.title, this.data.imageUrl).friend;
    },

    onShareTimeline() {
      return detailShare(kind, this.data.entityId, this.data.title, this.data.imageUrl).timeline;
    },

    async loadEntity() {
      const entityId = this.data.entityId;
      if (!entityId) return;
      this.setData({ errorMessage: "", loading: true });
      try {
        const detail = await publicPageCache.load(cacheKey(entityId), DETAIL_STALE_TIME, () =>
          requestJson<EntityDetail>(path(entityId)),
        );
        if (entityId !== this.data.entityId) return;
        this.setData(
          {
            badges: getEntityBadges(detail),
            imageUrl: detail.imageUrl ?? "",
            loaded: true,
            loading: false,
            summary: detail.summary ?? "",
            title: detail.name,
          },
          () => observeStickyTabs(this),
        );
        wx.setNavigationBarTitle({ title: detail.name });
        void this.loadTab(this.data.tabIndex);
      } catch (error) {
        if (entityId !== this.data.entityId) return;
        this.setData({ errorMessage: getErrorMessage(error), loaded: false, loading: false });
      }
    },

    async loadTab(tabIndex: number, force = false) {
      if (tabIndex === 0) {
        if (!force && (this.data.subjectsLoaded || this.data.subjectsLoading)) return;
        await this.loadSubjects();
        return;
      }
      if (!force && (this.data.relatedLoaded || this.data.relatedLoading)) return;
      await this.loadRelated();
    },

    async loadSubjects() {
      const entityId = this.data.entityId;
      this.setData({ subjectsError: "", subjectsLoading: true });
      try {
        const result = await publicPageCache.load(
          cacheKey(entityId, ":subjects"),
          DETAIL_STALE_TIME,
          () => requestJson<RelatedSubjectsResponse>(path(entityId, "/subjects")),
        );
        if (entityId !== this.data.entityId) return;
        this.setData({
          subjects: mapSubjectRelations(result.groups),
          subjectsLoaded: true,
          subjectsLoading: false,
        });
      } catch (error) {
        if (entityId !== this.data.entityId) return;
        this.setData({ subjectsError: getErrorMessage(error), subjectsLoading: false });
      }
    },

    async loadRelated() {
      const entityId = this.data.entityId;
      this.setData({ relatedError: "", relatedLoading: true });
      try {
        const result = await publicPageCache.load(
          cacheKey(entityId, `:${config.relatedTab}`),
          DETAIL_STALE_TIME,
          () => requestJson<RelatedResponse>(path(entityId, `/${config.relatedTab}`)),
        );
        if (entityId !== this.data.entityId) return;
        this.setData({
          related: config.mapRelated(result.groups),
          relatedLoaded: true,
          relatedLoading: false,
        });
      } catch (error) {
        if (entityId !== this.data.entityId) return;
        this.setData({ relatedError: getErrorMessage(error), relatedLoading: false });
      }
    },
  });
}
