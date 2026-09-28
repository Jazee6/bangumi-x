import { getTheme, subscribeTheme } from "../../../lib/theme";

const unsubscribers = new WeakMap<object, () => void>();

// 每个图标只渲染一张随主题切换的 lucide SVG。tone：default 前景色、muted 弱化前景色、
// inverse 反色（用于 primary 底色的按钮）。
Component({
  properties: {
    name: { type: String, value: "" },
    size: { type: Number, value: 16 },
    tone: { type: String, value: "default" },
  },
  data: { dark: getTheme() === "dark" },
  lifetimes: {
    attached() {
      const sync = (theme: string) => {
        if ((theme === "dark") !== this.data.dark) this.setData({ dark: theme === "dark" });
      };
      sync(getTheme());
      unsubscribers.set(this, subscribeTheme(sync));
    },
    detached() {
      unsubscribers.get(this)?.();
      unsubscribers.delete(this);
    },
  },
});
