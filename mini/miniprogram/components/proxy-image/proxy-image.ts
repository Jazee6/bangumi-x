import { proxyImageUrl } from "../../utils/request";

Component({
  properties: {
    src: { type: String, value: "" },
    mode: { type: String, value: "aspectFill" },
    lazy: { type: Boolean, value: true },
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
  },
});
