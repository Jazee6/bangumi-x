import {
  supportsChapterProgress,
  supportsProgress,
  type ChapterPage,
  type ChapterSummary,
  type CollectionList,
  type PersonalSubjectState,
  type SubjectCharactersResponse,
  type SubjectDetail,
  type SubjectPersonsResponse,
} from "share";

import {
  CHAPTER_PAGE_SIZE,
  DETAIL_STALE_TIME,
  backFromDetail,
  disconnectStickyTabs,
  getBroadcastBadge,
  mapCharacterRelations,
  mapPersonRelations,
  observeStickyTabs,
  parseDetailId,
  type DetailBadge,
  type DetailTab,
  type RelationGroupViewModel,
} from "../../../lib/detail-pages";
import { getMiniSession } from "../../../lib/mini-auth";
import { publicPageCache } from "../../../lib/memory-cache";
import { detailShare } from "../../../lib/public-sharing";
import {
  clearProgress,
  createCollectionList,
  loadCollectionLists,
  loadPersonalSubjectState,
  removeCollection,
  saveCollection,
  saveProgress,
} from "../../../lib/personal-records";
import { getErrorMessage, requestJson } from "../../../lib/request";
import { pagePatch } from "../../../lib/public-pages";
import { checkCollectionListName } from "../../../lib/validation";
import { vibrateForRecordChange } from "../../../lib/touch-feedback";

type SubjectTab = "chapters" | "characters" | "persons";
type SheetMode = "" | "lists";
type CollectionListOption = CollectionList & { selected: boolean };

interface ChapterRowViewModel {
  description: string;
  id: number;
  sequenceLabel: string;
  title: string;
}

const TABS: DetailTab[] = [
  { label: "章节", value: "chapters" },
  { label: "角色", value: "characters" },
  { label: "人物", value: "persons" },
];

function toChapterRow(chapter: ChapterSummary): ChapterRowViewModel {
  return {
    description: [chapter.type, chapter.date, chapter.duration].filter(Boolean).join(" · "),
    id: chapter.id,
    sequenceLabel: chapter.sequence === null ? "—" : `#${chapter.sequence}`,
    title: chapter.title,
  };
}

function getBadges(subject: SubjectDetail): DetailBadge[] {
  const broadcast = getBroadcastBadge(subject.broadcast);
  return [
    { value: subject.type },
    ...(subject.score === null
      ? []
      : [{ icon: "score" as const, value: subject.score.toFixed(1) }]),
    ...(subject.rank === null ? [] : [{ value: `#${subject.rank}` }]),
    ...(broadcast ? [{ value: broadcast }] : []),
    ...(subject.date ? [{ value: subject.date }] : []),
    ...(subject.platform ? [{ value: subject.platform }] : []),
  ];
}

Page({
  data: {
    badges: [] as DetailBadge[],
    blocked: false,
    collectionLists: [] as CollectionListOption[],
    creatingList: false,
    listsError: "",
    listsLoading: false,
    listSelection: [] as string[],
    listSkeletonRows: [0, 1, 2],
    personalLoading: false,
    personalState: null as PersonalSubjectState | null,
    readOnly: false,
    progressPending: false,
    chapterHasNext: false,
    chapterLoadMoreError: false,
    chapterLoadingMore: false,
    chapters: [] as ChapterRowViewModel[],
    chaptersLoaded: false,
    characters: [] as RelationGroupViewModel[],
    charactersLoaded: false,
    errorMessage: "",
    headerHeight: 0,
    heroTitleHidden: false,
    imageUrl: "",
    loaded: false,
    loading: true,
    originalTitle: "",
    chaptersError: "",
    chaptersLoading: false,
    charactersError: "",
    charactersLoading: false,
    personsError: "",
    personsLoading: false,
    panelSkeletonRows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    persons: [] as RelationGroupViewModel[],
    personsLoaded: false,
    sheetMode: "" as SheetMode,
    sheetOpen: false,
    sheetTitle: "",
    subjectId: 0,
    chapterProgressSupported: false,
    progressSupported: false,
    submitting: false,
    summary: "",
    tab: "chapters" as SubjectTab,
    tabIndex: 0,
    tabs: TABS,
    tabsStuck: false,
    tags: [] as string[],
    title: "",
    totalChapters: null as number | null,
  },

  listsLoadVersion: 0,
  personalVersion: 0,

  onLoad(options: Record<string, string | undefined>) {
    const subjectId = parseDetailId(options.id);
    if (!subjectId) {
      this.setData({ errorMessage: "条目 ID 无效。", loading: false });
      return;
    }
    this.setData({ subjectId, readOnly: [1129, 1154].includes(wx.getLaunchOptionsSync().scene) });
    void this.loadSubject();
  },

  onShow() {
    if (this.data.loaded && !this.data.blocked && !this.data.readOnly && getMiniSession())
      void this.loadPersonalState(true);
  },

  onBack() {
    if (this.data.sheetOpen) {
      this.closeSheet();
      return;
    }
    backFromDetail();
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height }, () => {
      if (this.data.loaded && !this.data.blocked) observeStickyTabs(this);
    });
  },

  onHeroMediaLayoutChange() {
    if (this.data.loaded && !this.data.blocked) observeStickyTabs(this);
  },

  onTitleVisibilityChange(event: WechatMiniprogram.CustomEvent<{ hidden: boolean }>) {
    this.setData({ heroTitleHidden: event.detail.hidden });
  },

  onUnload() {
    disconnectStickyTabs(this);
  },

  onTabChange(event: WechatMiniprogram.CustomEvent<{ value: SubjectTab }>) {
    const tab = event.detail.value;
    this.setData({ tab, tabIndex: this.data.tabs.findIndex((item) => item.value === tab) });
    void this.loadTab(tab);
  },

  onSwiperChange(event: WechatMiniprogram.CustomEvent<{ current: number }>) {
    const tab = this.data.tabs[event.detail.current]?.value as SubjectTab | undefined;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab, tabIndex: event.detail.current });
    void this.loadTab(tab);
  },

  onScrollLower() {
    if (
      this.data.tab !== "chapters" ||
      !this.data.chapterHasNext ||
      this.data.chapterLoadingMore ||
      this.data.chapterLoadMoreError
    ) {
      return;
    }
    void this.loadChapters(this.data.chapters.length, true);
  },

  onRetry() {
    void this.loadSubject();
  },

  onRetryPanel() {
    void this.loadTab(this.data.tab, true);
  },

  onRetryMore() {
    if (!this.data.chapterLoadingMore) {
      void this.loadChapters(this.data.chapters.length, true);
    }
  },

  onShareAppMessage() {
    return detailShare("subject", this.data.subjectId, this.data.title).friend;
  },

  onShareTimeline() {
    return detailShare("subject", this.data.subjectId, this.data.title).timeline;
  },

  async onToggleCollection() {
    const state = this.data.personalState;
    if (this.data.submitting) return;
    vibrateForRecordChange();
    this.setData({ submitting: true });
    try {
      const personalState = state?.collected
        ? { ...state, collected: false, listIds: [] }
        : { collected: true, listIds: [], progress: state?.progress ?? null };
      if (state?.collected) await removeCollection(this.data.subjectId);
      else await saveCollection(this.data.subjectId, []);
      this.setPersonalState(personalState);
      wx.showToast({ title: state?.collected ? "已取消收藏" : "已收藏", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onOpenLists() {
    if (this.data.submitting || this.data.sheetOpen) return;
    this.setData({ collectionLists: [], listSelection: [] });
    this.openSheet("lists", "收藏到列表");
    void this.loadLists();
  },

  onRetryLists() {
    void this.loadLists();
  },

  async loadLists() {
    if (this.data.listsLoading || !this.data.sheetOpen || this.data.sheetMode !== "lists") return;
    const version = ++this.listsLoadVersion;
    this.setData({ listsError: "", listsLoading: true });
    try {
      const [lists, state] = await Promise.all([
        loadCollectionLists(),
        loadPersonalSubjectState(this.data.subjectId),
      ]);
      if (
        version !== this.listsLoadVersion ||
        !this.data.sheetOpen ||
        this.data.sheetMode !== "lists"
      )
        return;
      this.setData({
        collectionLists: lists.data.map((list) => ({
          ...list,
          selected: state.listIds.includes(list.id),
        })),
        listSelection: state.listIds,
        listsLoading: false,
      });
      this.setPersonalState(state);
    } catch (error) {
      if (
        version !== this.listsLoadVersion ||
        !this.data.sheetOpen ||
        this.data.sheetMode !== "lists"
      )
        return;
      this.setData({ listsError: getErrorMessage(error), listsLoading: false });
    }
  },

  onListSelectionChange(event: WechatMiniprogram.CheckboxGroupChange) {
    const listSelection = event.detail.value;
    this.setData({
      collectionLists: this.data.collectionLists.map((list) => ({
        ...list,
        selected: listSelection.includes(list.id),
      })),
      listSelection,
    });
  },

  async onOpenCreateList() {
    if (
      this.data.submitting ||
      this.data.creatingList ||
      !this.data.sheetOpen ||
      this.data.sheetMode !== "lists"
    )
      return;
    const { confirm, content } = await wx.showModal({
      title: "新建收藏列表",
      editable: true,
      placeholderText: "列表名称",
      confirmText: "创建",
    });
    if (!confirm || !this.data.sheetOpen || this.data.sheetMode !== "lists") return;
    const name = content.trim();
    if (!checkCollectionListName(name)) return;
    const version = this.listsLoadVersion;
    this.setData({ creatingList: true });
    try {
      const created = await createCollectionList(name);
      const lists = await loadCollectionLists();
      if (
        version !== this.listsLoadVersion ||
        !this.data.sheetOpen ||
        this.data.sheetMode !== "lists"
      )
        return;
      const listSelection = [...new Set([...this.data.listSelection, created.id])];
      this.setData({
        collectionLists: lists.data.map((list) => ({
          ...list,
          selected: listSelection.includes(list.id),
        })),
        listSelection,
      });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ creatingList: false });
    }
  },

  async onSaveLists() {
    if (this.data.submitting || this.data.creatingList) return;
    vibrateForRecordChange();
    this.setData({ submitting: true });
    try {
      const saved = await saveCollection(this.data.subjectId, this.data.listSelection);
      const state = this.data.personalState;
      this.setPersonalState({
        collected: true,
        listIds: saved.listIds,
        progress: state?.progress ?? null,
      });
      this.closeSheet();
      wx.showToast({ title: "收藏列表已更新", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async onRecordProgress() {
    if (this.data.progressPending) return;
    vibrateForRecordChange();
    this.setData({ progressPending: true });
    try {
      const result = await saveProgress(this.data.subjectId, {
        stage: "in_progress",
        ...(this.data.chapterProgressSupported ? { completedChapters: 0 } : {}),
      });
      const state = this.data.personalState;
      this.setPersonalState({
        collected: state?.collected ?? false,
        listIds: state?.listIds ?? [],
        progress: result.progress,
      });
      wx.showToast({ title: "已开始记录", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ progressPending: false });
    }
  },

  onProgressStep(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    void this.updateProgress({ completedChapters: event.detail.value });
  },

  onChapterConfirm(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const value = event.detail.value.trim();
    const chapters = Number(value);
    const progress = this.data.personalState?.progress;
    if (!progress || this.data.progressPending) return;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(chapters)) {
      wx.showToast({ title: "请输入非负整数", icon: "none" });
      return;
    }
    if (chapters !== (progress.completedChapters ?? 0)) {
      void this.updateProgress({ completedChapters: chapters });
    }
  },

  onOpenProgressActions() {
    const progress = this.data.personalState?.progress;
    if (!progress || this.data.progressPending) return;
    const canReturnToOngoing =
      progress.stage !== "completed" ||
      !progress.totalChapters ||
      (progress.completedChapters ?? 0) < progress.totalChapters;
    wx.showActionSheet({
      itemList: [
        progress.stage === "in_progress"
          ? "标记已完成"
          : canReturnToOngoing
            ? "恢复进行中"
            : "恢复进行中（请先减少章节数）",
        "清除进度",
      ],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) this.onProgressAction("stage");
        if (tapIndex === 1) this.onProgressAction("clear");
      },
    });
  },

  onProgressAction(action: "stage" | "clear") {
    if (action === "clear") {
      void this.onRequestClearProgress();
      return;
    }
    const progress = this.data.personalState?.progress;
    if (!progress) return;
    if (
      progress.stage === "completed" &&
      progress.totalChapters &&
      (progress.completedChapters ?? 0) >= progress.totalChapters
    ) {
      wx.showToast({ title: "请先减少已完成章节数", icon: "none" });
      return;
    }
    void this.updateProgress({
      stage: progress.stage === "in_progress" ? "completed" : "in_progress",
    });
  },

  async updateProgress(update: {
    completedChapters?: number;
    stage?: "in_progress" | "completed";
  }) {
    const progress = this.data.personalState?.progress;
    if (!progress || this.data.progressPending) return;
    if (update.completedChapters !== undefined) {
      const count = update.completedChapters;
      if (
        !Number.isSafeInteger(count) ||
        count < 0 ||
        (progress.totalChapters !== null &&
          progress.totalChapters > 0 &&
          count > progress.totalChapters)
      ) {
        wx.showToast({ title: "章节数超出范围", icon: "none" });
        return;
      }
    }
    this.setData({ progressPending: true });
    vibrateForRecordChange();
    try {
      const result = await saveProgress(this.data.subjectId, update);
      this.setPersonalState({ ...this.data.personalState!, progress: result.progress });
      wx.showToast({ title: "进度已更新", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ progressPending: false });
    }
  },

  async onRequestClearProgress() {
    if (this.data.submitting || !this.data.personalState?.progress) return;
    const { confirm } = await wx.showModal({
      title: `清除“${this.data.title}”的进度？`,
      content: "进度记录将被删除，收藏记录不会受到影响。",
      confirmText: "清除",
    });
    if (!confirm || this.data.submitting || !this.data.personalState?.progress) return;
    vibrateForRecordChange();
    this.setData({ submitting: true });
    try {
      await clearProgress(this.data.subjectId);
      this.setPersonalState({ ...this.data.personalState!, progress: null });
      wx.showToast({ title: "进度已清除", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onCloseSheet() {
    this.closeSheet();
  },

  onSheetClosed() {
    if (!this.data.sheetOpen) this.setData({ sheetMode: "", sheetTitle: "" });
  },

  // 本地写入会递增版本号，较早发出的后台加载不会覆盖用户刚刚完成的操作。
  setPersonalState(personalState: PersonalSubjectState) {
    this.personalVersion += 1;
    this.setData({ personalState });
  },

  async loadPersonalState(background = false) {
    if (!this.data.subjectId || this.data.blocked) return;
    const version = ++this.personalVersion;
    this.setData({ personalLoading: !background });
    try {
      const personalState = await loadPersonalSubjectState(this.data.subjectId);
      if (version !== this.personalVersion) return;
      this.setData({ personalLoading: false, personalState });
    } catch (error) {
      if (version !== this.personalVersion) return;
      this.setData({ personalLoading: false });
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    }
  },

  openSheet(sheetMode: SheetMode, sheetTitle: string) {
    this.setData({ sheetMode, sheetOpen: true, sheetTitle });
  },

  closeSheet() {
    this.listsLoadVersion += 1;
    this.setData({ sheetOpen: false, listsLoading: false });
  },

  async loadSubject() {
    const subjectId = this.data.subjectId;
    if (!subjectId) return;
    this.setData({ errorMessage: "", loading: true });
    try {
      const subject = await publicPageCache.load(`subject:${subjectId}`, DETAIL_STALE_TIME, () =>
        requestJson<SubjectDetail>(`/subjects/${subjectId}`),
      );
      if (subjectId !== this.data.subjectId) return;
      if (subject.nsfw) {
        this.setData({ blocked: true, loaded: true, loading: false, title: "内容不可访问" });
        return;
      }
      this.setData(
        {
          badges: getBadges(subject),
          blocked: false,
          imageUrl: subject.imageUrl ?? "",
          loaded: true,
          loading: false,
          originalTitle: subject.originalTitle ?? "",
          chapterProgressSupported: supportsChapterProgress(subject.type),
          progressSupported: supportsProgress(subject.type),
          summary: subject.summary ?? "",
          tags: subject.tags,
          title: subject.title,
          totalChapters: subject.totalChapters,
        },
        () => observeStickyTabs(this),
      );
      wx.setNavigationBarTitle({ title: subject.title });
      if (!this.data.readOnly && getMiniSession()) void this.loadPersonalState();
      void this.loadTab(this.data.tab);
    } catch (error) {
      if (subjectId !== this.data.subjectId) return;
      this.setData({ errorMessage: getErrorMessage(error), loaded: false, loading: false });
    }
  },

  async loadTab(tab: SubjectTab, force = false) {
    if (tab === "chapters") {
      if (!force && (this.data.chaptersLoaded || this.data.chaptersLoading)) return;
      await this.loadChapters(0, false);
      return;
    }
    if (tab === "characters") {
      if (!force && (this.data.charactersLoaded || this.data.charactersLoading)) return;
      await this.loadCharacters();
      return;
    }
    if (!force && (this.data.personsLoaded || this.data.personsLoading)) return;
    await this.loadPersons();
  },

  async loadChapters(offset: number, append: boolean) {
    const subjectId = this.data.subjectId;
    this.setData({
      chapterLoadMoreError: false,
      chapterLoadingMore: append,
      chaptersError: "",
      chaptersLoading: !append,
    });
    try {
      const page = await publicPageCache.load(
        `subject:${subjectId}:chapters:${offset}`,
        DETAIL_STALE_TIME,
        () =>
          requestJson<ChapterPage>(`/subjects/${subjectId}/chapters`, {
            limit: CHAPTER_PAGE_SIZE,
            offset,
          }),
      );
      if (subjectId !== this.data.subjectId) return;
      const { patch } = pagePatch(
        "chapters",
        this.data.chapters,
        page.data.map(toChapterRow),
        append,
      );
      this.setData({
        ...patch,
        chapterHasNext: page.offset + page.limit < page.total,
        chapterLoadingMore: false,
        chaptersLoaded: true,
        chaptersLoading: false,
      });
    } catch (error) {
      if (subjectId !== this.data.subjectId) return;
      if (append) {
        this.setData({ chapterLoadMoreError: true, chapterLoadingMore: false });
        return;
      }
      this.setData({ chaptersError: getErrorMessage(error), chaptersLoading: false });
    }
  },

  async loadCharacters() {
    const subjectId = this.data.subjectId;
    this.setData({ charactersError: "", charactersLoading: true });
    try {
      const result = await publicPageCache.load(
        `subject:${subjectId}:characters`,
        DETAIL_STALE_TIME,
        () => requestJson<SubjectCharactersResponse>(`/subjects/${subjectId}/characters`),
      );
      if (subjectId !== this.data.subjectId) return;
      this.setData({
        characters: mapCharacterRelations(result.groups),
        charactersLoaded: true,
        charactersLoading: false,
      });
    } catch (error) {
      if (subjectId !== this.data.subjectId) return;
      this.setData({ charactersError: getErrorMessage(error), charactersLoading: false });
    }
  },

  async loadPersons() {
    const subjectId = this.data.subjectId;
    this.setData({ personsError: "", personsLoading: true });
    try {
      const result = await publicPageCache.load(
        `subject:${subjectId}:persons`,
        DETAIL_STALE_TIME,
        () => requestJson<SubjectPersonsResponse>(`/subjects/${subjectId}/persons`),
      );
      if (subjectId !== this.data.subjectId) return;
      this.setData({
        personsLoading: false,
        persons: mapPersonRelations(result.groups),
        personsLoaded: true,
      });
    } catch (error) {
      if (subjectId !== this.data.subjectId) return;
      this.setData({ personsError: getErrorMessage(error), personsLoading: false });
    }
  },
});
