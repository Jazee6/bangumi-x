// 与 web Input 默认样式一致：bg-input/50、rounded-3xl、h-9；clearable 时在右侧显示清除按钮。
Component({
  properties: {
    clearable: { type: Boolean, value: false },
    confirmType: { type: String, value: "done" },
    disabled: { type: Boolean, value: false },
    maxlength: { type: Number, value: 140 },
    placeholder: { type: String, value: "" },
    type: { type: String, value: "text" },
    value: { type: String, value: "" },
  },
  data: { focused: false },
  methods: {
    onInput(event: WechatMiniprogram.Input) {
      this.triggerEvent("input", { value: event.detail.value });
    },
    onConfirm(event: WechatMiniprogram.InputConfirm) {
      this.triggerEvent("confirm", { value: event.detail.value });
    },
    onFocus() {
      this.setData({ focused: true });
    },
    onBlur() {
      this.setData({ focused: false });
    },
    onClear() {
      this.triggerEvent("clear");
    },
  },
});
