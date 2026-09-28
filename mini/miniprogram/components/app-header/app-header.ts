// 状态栏与胶囊按钮的位置在小程序运行期间不变，模块加载时计算一次，所有页头共用。
function readHeaderGeometry() {
  const windowInfo = wx.getWindowInfo();
  const menuButton = wx.getMenuButtonBoundingClientRect();
  const statusBarHeight = windowInfo.statusBarHeight;
  const menuButtonGap = Math.max(menuButton.top - statusBarHeight, 0);
  const hasMenuButtonBounds = menuButton.width > 0 && menuButton.height > 0;
  const navigationBarHeight = hasMenuButtonBounds ? menuButton.height + menuButtonGap * 2 : 44;
  return {
    statusBarHeight,
    navigationBarHeight,
    horizontalInset: hasMenuButtonBounds ? windowInfo.windowWidth - menuButton.left : 16,
  };
}

const geometry = readHeaderGeometry();

Component({
  properties: {
    blur: {
      type: Boolean,
      value: true,
    },
    title: {
      type: String,
      value: "",
    },
    back: {
      type: Boolean,
      value: false,
    },
    transparent: {
      type: Boolean,
      value: false,
    },
  },
  data: geometry,
  methods: {
    onBack() {
      this.triggerEvent("back");
    },
  },
  lifetimes: {
    attached() {
      this.triggerEvent("headerheightchange", {
        height: geometry.statusBarHeight + geometry.navigationBarHeight,
      });
    },
  },
});
