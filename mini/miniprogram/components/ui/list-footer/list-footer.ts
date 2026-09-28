Component({
  properties: {
    state: { type: String, value: "hidden" },
  },
  methods: {
    onRetry() {
      this.triggerEvent("retry");
    },
  },
});
