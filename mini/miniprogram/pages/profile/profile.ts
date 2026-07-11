import { applyTheme, getCurrentDark } from "../../utils/page";
import { buildBrandShare } from "../../utils/share";

Page({
  data: {
    dark: getCurrentDark(),
  },
  onShow() {
    applyTheme.call(this);
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  onShareAppMessage() {
    return buildBrandShare("profile");
  },
  onShareTimeline() {
    return buildBrandShare("profile");
  },
});
