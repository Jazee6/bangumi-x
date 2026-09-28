Component({
  behaviors: ["wx://form-field-button"],
  externalClasses: ["custom-class"],
  properties: {
    variant: {
      type: String,
      value: "default",
    },
    size: {
      type: String,
      value: "default",
    },
    // 撑满整行，对应 web 的 w-full；默认按内容宽度。
    block: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    formType: {
      type: String,
      value: "",
    },
    openType: {
      type: String,
      value: "",
    },
    hoverClass: {
      type: String,
      value: "ui-button--pressed",
    },
    hoverStopPropagation: {
      type: Boolean,
      value: false,
    },
    hoverStartTime: {
      type: Number,
      value: 20,
    },
    hoverStayTime: {
      type: Number,
      value: 70,
    },
    lang: {
      type: String,
      value: "en",
    },
    sessionFrom: {
      type: String,
      value: "",
    },
    sendMessageTitle: {
      type: String,
      value: "当前标题",
    },
    sendMessagePath: {
      type: String,
      value: "当前分享路径",
    },
    sendMessageImg: {
      type: String,
      value: "截图",
    },
    appParameter: {
      type: String,
      value: "",
    },
    showMessageCard: {
      type: Boolean,
      value: false,
    },
    phoneNumberNoQuotaToast: {
      type: Boolean,
      value: true,
    },
    needShowEntrance: {
      type: Boolean,
      value: true,
    },
    entrancePath: {
      type: String,
      value: "",
    },
    ariaLabel: {
      type: String,
      value: "",
    },
  },
  data: {
    iconOnly: false,
  },
  observers: {
    size(size: string) {
      this.setData({ iconOnly: size.startsWith("icon") });
    },
  },
  methods: {
    forwardOpenTypeEvent(event: WechatMiniprogram.CustomEvent) {
      this.triggerEvent(event.type, event.detail);
    },
  },
});
