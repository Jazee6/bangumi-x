Component({
  options: { virtualHost: true },
  properties: {
    value: { type: Number, value: 0 },
    total: { type: Number, value: 0 },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
  },
  data: {
    inputValue: "0",
  },
  observers: {
    value(value: number) {
      this.setData({ inputValue: String(value) });
    },
    loading(loading: boolean) {
      if (!loading) this.setData({ inputValue: String(this.properties.value) });
    },
  },
  methods: {
    onMinus() {
      if (this.properties.disabled || this.properties.loading || this.properties.value <= 0) return;
      this.triggerEvent("change", { value: this.properties.value - 1 });
    },
    onPlus() {
      if (
        this.properties.disabled ||
        this.properties.loading ||
        this.properties.value >= Number.MAX_SAFE_INTEGER ||
        (this.properties.total > 0 && this.properties.value >= this.properties.total)
      )
        return;
      this.triggerEvent("change", { value: this.properties.value + 1 });
    },
    onInput(event: WechatMiniprogram.Input) {
      this.triggerEvent("inputchange", { value: event.detail.value });
    },
    onConfirm(event: WechatMiniprogram.Input) {
      const value = event.detail.value.trim();
      const count = Number(value);
      this.triggerEvent("confirm", { value });
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(count) ||
        (this.properties.total > 0 && count > this.properties.total)
      ) {
        this.setData({ inputValue: String(this.properties.value) });
      }
    },
  },
});
