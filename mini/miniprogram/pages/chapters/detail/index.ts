import type { ChapterDetail } from "share";

import {
  DETAIL_STALE_TIME,
  backFromDetail,
  parseDetailId,
  type DetailBadge,
} from "../../../lib/detail-pages";
import { publicPageCache } from "../../../lib/memory-cache";
import { detailShare } from "../../../lib/public-sharing";
import { getErrorMessage, requestJson } from "../../../lib/request";

function getBadges(chapter: ChapterDetail): DetailBadge[] {
  return [
    { value: chapter.type },
    ...(chapter.sequence === null ? [] : [{ value: `#${chapter.sequence}` }]),
    ...(chapter.date ? [{ value: chapter.date }] : []),
    ...(chapter.duration ? [{ value: chapter.duration }] : []),
  ];
}

Page({
  data: {
    badges: [] as DetailBadge[],
    blocked: false,
    chapterId: 0,
    errorMessage: "",
    headerHeight: 0,
    heroTitleHidden: false,
    imageUrl: "",
    loaded: false,
    loading: true,
    subjectId: 0,
    subjectTitle: "",
    subjectType: "",
    summary: "",
    title: "",
  },

  onLoad(options: Record<string, string | undefined>) {
    const chapterId = parseDetailId(options.id);
    if (!chapterId) {
      this.setData({ errorMessage: "章节 ID 无效。", loading: false });
      return;
    }
    this.setData({ chapterId });
    void this.loadChapter();
  },

  onBack() {
    backFromDetail();
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onTitleVisibilityChange(event: WechatMiniprogram.CustomEvent<{ hidden: boolean }>) {
    this.setData({ heroTitleHidden: event.detail.hidden });
  },

  onRetry() {
    void this.loadChapter();
  },

  onShareAppMessage() {
    return detailShare("chapter", this.data.chapterId, this.data.title, this.data.imageUrl).friend;
  },

  onShareTimeline() {
    return detailShare("chapter", this.data.chapterId, this.data.title, this.data.imageUrl)
      .timeline;
  },

  async loadChapter() {
    const chapterId = this.data.chapterId;
    if (!chapterId) return;
    this.setData({ errorMessage: "", loading: true });
    try {
      const chapter = await publicPageCache.load(`chapter:${chapterId}`, DETAIL_STALE_TIME, () =>
        requestJson<ChapterDetail>(`/chapters/${chapterId}`),
      );
      if (chapterId !== this.data.chapterId) return;
      if (chapter.subject.nsfw) {
        this.setData({ blocked: true, loaded: true, loading: false, title: "内容不可访问" });
        return;
      }
      this.setData({
        badges: getBadges(chapter),
        blocked: false,
        imageUrl: chapter.subject.imageUrl ?? "",
        loaded: true,
        loading: false,
        subjectId: chapter.subject.id,
        subjectTitle: chapter.subject.title,
        subjectType: chapter.subject.type,
        summary: chapter.summary ?? "",
        title: chapter.title,
      });
      wx.setNavigationBarTitle({ title: chapter.title });
    } catch (error) {
      if (chapterId !== this.data.chapterId) return;
      this.setData({ errorMessage: getErrorMessage(error), loaded: false, loading: false });
    }
  },
});
