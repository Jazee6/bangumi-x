Component({
  properties: {
    title: { type: String, value: "暂无数据" },
    description: { type: String, value: "" },
    retry: { type: Boolean, value: false },
  },
  methods: {
    onRetry() {
      this.triggerEvent("retry");
    },
  },
});
