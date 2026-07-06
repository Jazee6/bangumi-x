Component({
  properties: {
    type: { type: String, value: "card" },
    count: { type: Number, value: 6 },
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
