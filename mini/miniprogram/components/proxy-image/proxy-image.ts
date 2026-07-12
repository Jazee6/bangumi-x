import { proxyImageUrl } from "../../utils/request";

Component({
  properties: {
    src: { type: String, value: "" },
    mode: { type: String, value: "aspectFill" },
    lazy: { type: Boolean, value: true },
    preview: { type: Boolean, value: false },
  },
  data: {
    proxied: "",
    errored: false,
  },
  observers: {
    src(v: string) {
      this.setData({
        proxied: proxyImageUrl(v),
        errored: false,
      });
    },
  },
  methods: {
    onError() {
      this.setData({ errored: true });
    },
    onPreview() {
      if (!this.data.preview || !this.data.proxied) return;
      wx.previewImage({ current: this.data.proxied, urls: [this.data.proxied] });
    },
  },
});
