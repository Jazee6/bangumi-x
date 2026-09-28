export interface TabOption {
  count?: string;
  disabled?: boolean;
  label: string;
  value: number | string;
}

// line：详情页下划线标签；pill：与 web TabsList 默认样式一致的筛选标签。
// fit 让标签按内容宽度排列，否则平分整行。
Component({
  properties: {
    fit: { type: Boolean, value: false },
    tabs: { type: Array, value: [] as unknown as TabOption[] },
    value: { type: String, optionalTypes: [Number], value: "" },
    variant: { type: String, value: "line" },
  },
  methods: {
    onSelect(event: WechatMiniprogram.TouchEvent) {
      const { disabled, value } = event.currentTarget.dataset as {
        disabled?: boolean;
        value?: number | string;
      };
      if (disabled || value === undefined || value === "" || value === this.properties.value)
        return;
      this.triggerEvent("change", { value });
    },
  },
});
