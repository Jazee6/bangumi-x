import { ICON_BACK_LIGHT, ICON_BACK_DARK } from "../../utils/icons";

Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    extClass: {
      type: String,
      value: "",
    },
    title: {
      type: String,
      value: "",
    },
    background: {
      type: String,
      value: "",
    },
    color: {
      type: String,
      value: "",
    },
    dark: {
      type: Boolean,
      value: false,
    },
    back: {
      type: Boolean,
      value: true,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    homeButton: {
      type: Boolean,
      value: false,
    },
    animated: {
      type: Boolean,
      value: true,
    },
    show: {
      type: Boolean,
      value: true,
      observer: "_showChange",
    },
    delta: {
      type: Number,
      value: 1,
    },
  },
  data: {
    displayStyle: "",
    backIcon: ICON_BACK_LIGHT,
  },
  observers: {
    dark(d: boolean) {
      this.setData({ backIcon: d ? ICON_BACK_DARK : ICON_BACK_LIGHT });
    },
  },
  lifetimes: {
    attached() {
      const rect = wx.getMenuButtonBoundingClientRect();
      const device = wx.getDeviceInfo();
      const win = wx.getWindowInfo();
      const isAndroid = device.platform === "android";
      const isDevtools = device.platform === "devtools";
      this.setData({
        ios: !isAndroid,
        innerPaddingRight: `padding-right: ${win.windowWidth - rect.left}px`,
        leftWidth: `width: ${win.windowWidth - rect.left}px`,
        safeAreaTop:
          isDevtools || isAndroid
            ? `height: calc(var(--height) + ${win.safeArea.top}px); padding-top: ${win.safeArea.top}px`
            : ``,
        backIcon: this.data.dark ? ICON_BACK_DARK : ICON_BACK_LIGHT,
      });
    },
  },
  methods: {
    _showChange(show: boolean) {
      const animated = this.data.animated;
      let displayStyle = "";
      if (animated) {
        displayStyle = `opacity: ${show ? "1" : "0"};transition:opacity 0.5s;`;
      } else {
        displayStyle = `display: ${show ? "" : "none"}`;
      }
      this.setData({
        displayStyle,
      });
    },
    back() {
      const data = this.data;
      if (data.delta) {
        if (getCurrentPages().length > data.delta) {
          wx.navigateBack({ delta: data.delta });
        } else {
          wx.switchTab({ url: "/pages/index/index" });
        }
      }
      this.triggerEvent("back", { delta: data.delta }, {});
    },
    home() {
      wx.switchTab({ url: "/pages/index/index" });
    },
  },
});
