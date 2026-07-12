import { applyTheme, getCurrentDark } from "../../utils/page";
import { applyLayout } from "../../utils/layout";
import { buildBrandShare, buildBrandTimelineShare, enableShareMenu } from "../../utils/share";
import { browseSubjects, searchSubjects, searchCharacters, searchPersons } from "../../utils/api";
import type { Subject, Character, Person, PagedResponse } from "../../types";
import { SubjectType } from "../../types";

type Tab = "subject" | "character" | "person";

type SubjectFilter = "all" | "book" | "anime" | "music" | "game" | "real";

const FILTER_OPTIONS: { value: SubjectFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "book", label: "书籍" },
  { value: "anime", label: "动画" },
  { value: "music", label: "音乐" },
  { value: "game", label: "游戏" },
  { value: "real", label: "三次元" },
];

const FILTER_TO_TYPE: Record<SubjectFilter, SubjectType | null> = {
  all: null,
  book: SubjectType.Book,
  anime: SubjectType.Anime,
  music: SubjectType.Music,
  game: SubjectType.Game,
  real: SubjectType.Real,
};

const PAGE_SIZE = 20;

// Only the newest request for each page instance may update it. Search, tab and
// filter changes can otherwise let a slower response overwrite the current view.
const requestGenerations = new WeakMap<object, number>();

function beginRequest(page: object): number {
  const generation = (requestGenerations.get(page) ?? 0) + 1;
  requestGenerations.set(page, generation);
  return generation;
}

function isCurrentRequest(page: object, generation: number): boolean {
  return generation === requestGenerations.get(page);
}

interface SubjectItem {
  id: number;
  name: string;
  nameCn: string;
  image: string;
  score: number;
}
interface CellItem {
  id: number;
  title: string;
  description: string;
  image: string;
  target: string;
}

function tabHasList(tab: Tab, data: { subjectList: unknown[]; characterList: unknown[]; personList: unknown[] }): boolean {
  if (tab === "subject") return data.subjectList.length > 0;
  if (tab === "character") return data.characterList.length > 0;
  return data.personList.length > 0;
}

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
    tab: "subject" as Tab,
    keyword: "",
    filterOptions: FILTER_OPTIONS,
    filterIndex: 0,
    loading: false,
    error: false,
    hasMore: false,
    hasList: false,
    offset: 0,
    subjectList: [] as SubjectItem[],
    characterList: [] as CellItem[],
    personList: [] as CellItem[],
    tabs: [
      { value: "subject", label: "条目" },
      { value: "character", label: "角色" },
      { value: "person", label: "人物" },
    ],
  },
  onLoad() {
    enableShareMenu();
    wx.setNavigationBarTitle({ title: "番组、角色与人物搜索｜番迹" });
    this.loadDefault();
  },
  onShow() {
    applyTheme.call(this);
    applyLayout.call(this);
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  onResize() {
    applyLayout.call(this);
  },
  onUnload() {
    beginRequest(this);
  },
  onPickTab(e: WechatMiniprogram.TouchEvent) {
    const v = e.currentTarget.dataset.value as Tab;
    if (v === this.data.tab) return;
    beginRequest(this);
    this.setData({ tab: v, hasList: tabHasList(v, this.data), loading: false, error: false });
    if (this.data.keyword) {
      this.loadData(true);
    } else if (v === "subject" && this.data.subjectList.length === 0) {
      this.loadDefault();
    }
  },
  onSearch(e: { detail: { value: string } }) {
    const keyword = e.detail.value.trim();
    this.setData({ keyword });
    if (!keyword) {
      this.clearResults();
      if (this.data.tab === "subject") {
        this.loadDefault();
      }
      return;
    }
    this.loadData(true);
  },
  clearResults() {
    beginRequest(this);
    this.setData({
      subjectList: [],
      characterList: [],
      personList: [],
      hasMore: false,
      hasList: false,
      offset: 0,
      loading: false,
      error: false,
    });
  },
  currentFilter(): SubjectFilter {
    return FILTER_OPTIONS[this.data.filterIndex]?.value ?? "all";
  },
  currentFilterType(): SubjectType | null {
    return FILTER_TO_TYPE[this.currentFilter()] ?? null;
  },
  onPickFilter(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as SubjectFilter;
    const filterIndex = FILTER_OPTIONS.findIndex((option) => option.value === value);
    if (filterIndex < 0 || filterIndex === this.data.filterIndex) return;
    this.setData({ filterIndex, subjectList: [], offset: 0, hasMore: false, hasList: false });
    if (this.data.keyword) this.loadData(true);
    else this.loadDefault();
  },
  async loadDefault() {
    const generation = beginRequest(this);
    this.setData({ loading: true, error: false });
    try {
      const type = this.currentFilterType() ?? SubjectType.Anime;
      const res: PagedResponse<Subject> = await browseSubjects(type, PAGE_SIZE, 0);
      const list = res.data.map((s) => ({
        id: s.id,
        name: s.name,
        nameCn: s.name_cn,
        image: s.images?.large || s.images?.common || "",
        score: s.rating?.score ?? 0,
      }));
      if (!isCurrentRequest(this, generation)) return;
      this.setData({
        subjectList: list,
        offset: list.length,
        hasMore: list.length < res.total,
        hasList: list.length > 0,
        loading: false,
      });
    } catch {
      if (!isCurrentRequest(this, generation)) return;
      this.setData({ loading: false, error: true });
    }
  },
  async loadData(reset: boolean) {
    const { tab, keyword, offset } = this.data;
    if (!keyword) return;
    const generation = beginRequest(this);
    const newOffset = reset ? 0 : offset;
    this.setData({ loading: true, error: false });
    try {
      let result: { list: SubjectItem[] | CellItem[]; total: number };
      if (tab === "subject") {
        result = await this.searchSubjects(keyword, newOffset);
      } else if (tab === "character") {
        result = await this.searchCharacters(keyword, newOffset);
      } else {
        result = await this.searchPersons(keyword, newOffset);
      }
      if (!isCurrentRequest(this, generation)) return;
      const list = result.list;
      const key = (tab + "List") as "subjectList" | "characterList" | "personList";
      const nextList = reset ? list : [...(this.data[key] as typeof list), ...list];
      this.setData({
        [key]: nextList,
        offset: newOffset + list.length,
        hasMore: newOffset + list.length < result.total,
        hasList: nextList.length > 0,
        loading: false,
      });
    } catch {
      if (!isCurrentRequest(this, generation)) return;
      this.setData({ loading: false, error: reset });
      if (!reset) wx.showToast({ title: "加载失败", icon: "none" });
    }
  },
  async searchSubjects(keyword: string, offset: number): Promise<{ list: SubjectItem[]; total: number }> {
    const type = this.currentFilterType() ?? undefined;
    const res: PagedResponse<Subject> = await searchSubjects(keyword, PAGE_SIZE, offset, type);
    const list = res.data.map((s) => ({
      id: s.id,
      name: s.name,
      nameCn: s.name_cn,
      image: s.images?.large || s.images?.common || "",
      score: s.rating?.score ?? 0,
    }));
    return { list, total: res.total };
  },
  async searchCharacters(keyword: string, offset: number): Promise<{ list: CellItem[]; total: number }> {
    const res: PagedResponse<Character> = await searchCharacters(keyword, PAGE_SIZE, offset);
    const list = res.data.map((c) => ({
      id: c.id,
      title: c.name,
      description: "",
      image: c.images?.large || c.images?.medium || "",
      target: "character",
    }));
    return { list, total: res.total };
  },
  async searchPersons(keyword: string, offset: number): Promise<{ list: CellItem[]; total: number }> {
    const res: PagedResponse<Person> = await searchPersons(keyword, PAGE_SIZE, offset);
    const list = res.data.map((p) => ({
      id: p.id,
      title: p.name,
      description: "",
      image: p.images?.large || p.images?.medium || "",
      target: "person",
    }));
    return { list, total: res.total };
  },
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    if (!this.data.keyword && this.data.tab === "subject") {
      this.loadMoreDefault();
      return;
    }
    this.loadData(false);
  },
  async loadMoreDefault() {
    const { offset } = this.data;
    const generation = beginRequest(this);
    this.setData({ loading: true, error: false });
    try {
      const type = this.currentFilterType() ?? SubjectType.Anime;
      const res: PagedResponse<Subject> = await browseSubjects(type, PAGE_SIZE, offset);
      const list = res.data.map((s) => ({
        id: s.id,
        name: s.name,
        nameCn: s.name_cn,
        image: s.images?.large || s.images?.common || "",
        score: s.rating?.score ?? 0,
      }));
      if (!isCurrentRequest(this, generation)) return;
      const subjectList = [...this.data.subjectList, ...list];
      this.setData({
        subjectList,
        offset: offset + list.length,
        hasMore: offset + list.length < res.total,
        hasList: subjectList.length > 0,
        loading: false,
      });
    } catch {
      if (!isCurrentRequest(this, generation)) return;
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },
  onRetry() {
    if (this.data.keyword) {
      this.loadData(true);
    } else {
      this.loadDefault();
    }
  },
  onShareAppMessage() {
    return buildBrandShare("discover");
  },
  onShareTimeline() {
    return buildBrandTimelineShare("discover");
  },
});
