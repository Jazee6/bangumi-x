import { getSubject, getSubjectCharacters, getSubjectEpisodes, getSubjectPersons } from "../../utils/api";
import { applyTheme, getCurrentDark } from "../../utils/page";
import { applyLayout } from "../../utils/layout";
import { buildSubjectShare, buildBrandShare, getSubjectTitle } from "../../utils/share";
import { ICON_COPY_LIGHT, ICON_COPY_DARK } from "../../utils/icons";
import { characterRelationOrder, groupByRelation, personRelationOrder } from "../../utils/relation";
import {
  type Episode,
  EpTypeLabel,
  type RelatedCharacter,
  type RelatedPerson,
  type Subject,
  SubjectTypeLabel,
} from "../../types";

const EPISODE_PAGE_SIZE = 20;

type Tab = 0 | 1 | 2;

interface EpisodeItem {
  id: number;
  sort: number;
  title: string;
  meta: string;
  episode: Episode;
}
interface CellItem {
  id: number;
  title: string;
  description: string;
  image: string;
  target: "character" | "person";
}
interface RelationGroup {
  relation: string;
  items: CellItem[];
}

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
    loading: true,
    error: false,
    subject: null as Subject | null,
    typeLabel: "",
    activeTab: 0 as Tab,
    copyIcon: ICON_COPY_LIGHT,
    tabs: [
      { value: 0, label: "章节" },
      { value: 1, label: "角色" },
      { value: 2, label: "制作人员" },
    ],
    episodes: [] as EpisodeItem[],
    episodeTotal: 0,
    episodeOffset: 0,
    episodeHasMore: false,
    episodesLoading: false,
    characters: [] as RelationGroup[],
    charactersLoading: false,
    charactersLoaded: false,
    persons: [] as RelationGroup[],
    personsLoading: false,
    personsLoaded: false,
  },
  onLoad(query: { id?: string }) {
    const id = Number(query?.id ?? 0);
    if (!id) {
      this.setData({ loading: false, error: true });
      return;
    }
    this.loadData(id);
  },
  onShow() {
    applyTheme.call(this);
    applyLayout.call(this);
    this.setData({ copyIcon: getCurrentDark() ? ICON_COPY_DARK : ICON_COPY_LIGHT });
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  onResize() {
    applyLayout.call(this);
  },
  async loadData(id: number) {
    this.setData({ loading: true, error: false });
    try {
      const subject = await getSubject(id);
      if (!subject) {
        this.setData({ loading: false, error: true });
        return;
      }
      const typeLabel = SubjectTypeLabel[subject.type] ?? "条目";
      wx.setNavigationBarTitle({ title: getSubjectTitle(subject) });
      this.setData({ subject, typeLabel, loading: false });
      this.loadEpisodes();
    } catch {
      this.setData({ loading: false, error: true });
    }
  },
  onRetry() {
    const s = this.data.subject;
    if (s) this.loadData(s.id);
  },
  onPickTab(e: WechatMiniprogram.TouchEvent) {
    const v = Number(e.currentTarget.dataset.value) as Tab;
    if (v === this.data.activeTab) return;
    this.setData({ activeTab: v });
    this.ensureTabLoaded(v);
  },
  onSwiperChange(e: { detail: { current: number } }) {
    const v = e.detail.current as Tab;
    this.setData({ activeTab: v });
    this.ensureTabLoaded(v);
  },
  ensureTabLoaded(tab: Tab) {
    if (tab === 0 && this.data.episodes.length === 0 && !this.data.episodesLoading) {
      this.loadEpisodes();
    } else if (tab === 1 && !this.data.charactersLoaded && !this.data.charactersLoading) {
      this.loadCharacters();
    } else if (tab === 2 && !this.data.personsLoaded && !this.data.personsLoading) {
      this.loadPersons();
    }
  },
  async loadEpisodes(reset = true) {
    const subject = this.data.subject;
    if (!subject) return;
    const offset = reset ? 0 : this.data.episodeOffset;
    this.setData({ episodesLoading: true });
    try {
      const res = await getSubjectEpisodes(subject.id, EPISODE_PAGE_SIZE, offset);
      const items = res.data.map((ep: Episode) => {
        const typeLabel = ep.type !== 0 ? (EpTypeLabel[ep.type as keyof typeof EpTypeLabel] ?? "") : "";
        const meta = [typeLabel, ep.airdate, ep.duration].filter(Boolean).join(" · ");
        return {
          id: ep.id,
          sort: ep.sort,
          title: ep.name_cn || ep.name,
          meta,
          episode: ep,
        };
      });
      this.setData({
        episodes: reset ? items : [...this.data.episodes, ...items],
        episodeOffset: offset + items.length,
        episodeTotal: res.total,
        episodeHasMore: offset + items.length < res.total,
        episodesLoading: false,
      });
    } catch {
      this.setData({ episodesLoading: false });
    }
  },
  async loadCharacters() {
    const subject = this.data.subject;
    if (!subject) return;
    this.setData({ charactersLoading: true });
    try {
      const list = await getSubjectCharacters(subject.id);
      const groups = groupByRelation(list, characterRelationOrder).map(([relation, items]) => ({
        relation,
        items: items.map((c: RelatedCharacter) => ({
          id: c.id,
          title: c.name,
          description: c.relation,
          image: c.images?.large || c.images?.medium || "",
          target: "character" as const,
        })),
      }));
      this.setData({ characters: groups, charactersLoading: false, charactersLoaded: true });
    } catch {
      this.setData({ charactersLoading: false, charactersLoaded: true });
    }
  },
  async loadPersons() {
    const subject = this.data.subject;
    if (!subject) return;
    this.setData({ personsLoading: true });
    try {
      const list = await getSubjectPersons(subject.id);
      const groups = groupByRelation(list, personRelationOrder).map(([relation, items]) => ({
        relation,
        items: items.map((p: RelatedPerson) => ({
          id: p.id,
          title: p.name,
          description: p.relation,
          image: p.images?.large || p.images?.medium || "",
          target: "person" as const,
        })),
      }));
      this.setData({ persons: groups, personsLoading: false, personsLoaded: true });
    } catch {
      this.setData({ personsLoading: false, personsLoaded: true });
    }
  },
  onLoadMoreEpisodes() {
    if (!this.data.episodeHasMore || this.data.episodesLoading) return;
    this.loadEpisodes(false);
  },
  onCopyTitle() {
    const s = this.data.subject;
    if (!s) return;
    wx.setClipboardData({
      data: s.name_cn || s.name,
      success: () => wx.showToast({ title: "已复制", icon: "success" }),
    });
  },
  onShareAppMessage() {
    const s = this.data.subject;
    if (!s) return buildBrandShare("index");
    return buildSubjectShare(s);
  },
  onShareTimeline() {
    const s = this.data.subject;
    if (!s) return buildBrandShare("index");
    return buildSubjectShare(s);
  },
});
