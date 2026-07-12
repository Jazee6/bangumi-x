import { applyTheme, getCurrentDark } from "../../utils/page";
import { applyLayout } from "../../utils/layout";
import { buildBrandShare } from "../../utils/share";

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
  },
  onShow() {
    applyTheme.call(this);
    applyLayout.call(this);
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  onResize() {
    applyLayout.call(this);
  },
  onShareAppMessage() {
    return buildBrandShare("profile");
  },
  onShareTimeline() {
    return buildBrandShare("profile");
  },
});
