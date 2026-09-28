import { MAX_NAVIGATE_DEPTH } from "../../../lib/detail-pages";

// 详情链接直接在 WXML 中拼接（与 getDetailPath 的 /pages/{target}s/detail 规则一致），
// 避免长列表里每一行都为生成链接调用一次 setData。
Component({
  properties: {
    entityId: { type: Number, value: 0 },
    publicLink: { type: Boolean, value: false },
    target: { type: String, value: "" },
    description: { type: String, value: "" },
    imageUrl: { type: String, value: "" },
    imageTop: { type: Boolean, value: false },
    name: { type: String, value: "" },
    placeholderText: { type: String, value: "—" },
    plainPlaceholder: { type: Boolean, value: false },
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
      if (this.properties.entityId > 0 && this.properties.target) {
        this.triggerEvent("select", {
          id: this.properties.entityId,
          target: this.properties.target,
        });
      }
    },
    onImageError() {
      this.setData({ imageFailed: true });
    },
  },
});
