const ICON_LIGHT =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxODE4MWIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI4Ii8+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCIvPjwvc3ZnPg==";
const ICON_DARK =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmYWZhZmEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI4Ii8+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCIvPjwvc3ZnPg==";

Component({
  properties: {
    value: { type: String, value: "" },
    placeholder: { type: String, value: "搜索..." },
    dark: { type: Boolean, value: false },
  },
  data: {
    inner: "",
    icon: ICON_LIGHT,
  },
  observers: {
    value(v: string) {
      this.setData({ inner: v });
    },
    dark(d: boolean) {
      this.setData({ icon: d ? ICON_DARK : ICON_LIGHT });
    },
  },
  methods: {
    onInput(e: WechatMiniprogram.Input) {
      this.setData({ inner: e.detail.value });
    },
    onConfirm(e: WechatMiniprogram.InputConfirm) {
      const v = (e.detail.value ?? this.data.inner).trim();
      this.triggerEvent("search", { value: v });
    },
    onClear() {
      this.setData({ inner: "" });
      this.triggerEvent("search", { value: "" });
    },
  },
});
