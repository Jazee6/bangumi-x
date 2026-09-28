Component({
  options: { multipleSlots: true },
  properties: {
    description: { type: String, value: "" },
    // Skyline 不支持 :empty，有 action 插槽内容时由使用方显式声明。
    hasAction: { type: Boolean, value: false },
    icon: { type: String, value: "package-open" },
    symbol: { type: String, value: "" },
    title: { type: String, value: "" },
    variant: { type: String, value: "outline" },
  },
});
