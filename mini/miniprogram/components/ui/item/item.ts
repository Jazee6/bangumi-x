// 对应 web Item 的移动端列表行。end 插槽放徽标或头像；默认插槽用于铺满整行的
// 透明 open-type 按钮（分享、选择头像）。
Component({
  options: { multipleSlots: true },
  properties: {
    bordered: { type: Boolean, value: false },
    chevron: { type: Boolean, value: false },
    description: { type: String, value: "" },
    destructive: { type: Boolean, value: false },
    pressable: { type: Boolean, value: true },
    title: { type: String, value: "" },
    value: { type: String, value: "" },
  },
});
