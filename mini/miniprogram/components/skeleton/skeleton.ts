Component({
  properties: {
    type: { type: String, value: "card" },
    count: { type: Number, value: 9 },
    expanded: { type: Boolean, value: false },
    topPadding: { type: Number, value: 16 },
    inset: { type: Boolean, value: false },
  },
  data: {
    items: [] as number[],
  },
  observers: {
    count(n: number) {
      this.setData({ items: Array.from({ length: n }, (_, i) => i) });
    },
  },
  lifetimes: {
    attached() {
      this.setData({ items: Array.from({ length: this.data.count }, (_, i) => i) });
    },
  },
});
