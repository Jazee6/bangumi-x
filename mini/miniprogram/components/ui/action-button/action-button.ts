Component({
  options: {
    virtualHost: true,
  },
  properties: {
    label: { type: String, value: "" },
    icon: { type: String, value: "" },
    iconOnly: { type: Boolean, value: false },
    ariaLabel: { type: String, value: "" },
    variant: { type: String, value: "outline" },
    size: { type: String, value: "default" },
    groupPosition: { type: String, value: "" },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
  },
  methods: {
    onPress() {
      if (this.properties.disabled || this.properties.loading) return;
      this.triggerEvent("press");
    },
  },
});
