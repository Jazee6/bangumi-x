import { applyTheme, getCurrentDark } from "../../utils/page";
import { applyLayout } from "../../utils/layout";
import { buildBrandShare, buildBrandTimelineShare, enableShareMenu } from "../../utils/share";

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
  },
  onLoad() {
    enableShareMenu();
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
    return buildBrandTimelineShare("profile");
  },
});
