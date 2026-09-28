import { MAX_NAVIGATE_DEPTH } from "../../../lib/detail-pages";

// 详情链接直接在 WXML 中拼接，避免长列表里每张卡片都为生成链接调用一次 setData。
Component({
  properties: {
    subjectId: { type: Number, value: 0 },
    publicLink: { type: Boolean, value: false },
    imageUrl: { type: String, value: "" },
    rankLabel: { type: String, value: "" },
    scoreLabel: { type: String, value: "" },
    title: { type: String, value: "" },
  },
  data: { imageFailed: false, openType: "navigate" },
  observers: {
    imageUrl() {
      if (this.data.imageFailed) this.setData({ imageFailed: false });
    },
  },
  lifetimes: {
    attached() {
      if (getCurrentPages().length >= MAX_NAVIGATE_DEPTH) this.setData({ openType: "redirect" });
    },
  },
  methods: {
    onSelect() {
      if (this.properties.publicLink) return;
      if (this.properties.subjectId > 0) {
        this.triggerEvent("select", { id: this.properties.subjectId });
      }
    },
    onImageError() {
      this.setData({ imageFailed: true });
    },
  },
});
