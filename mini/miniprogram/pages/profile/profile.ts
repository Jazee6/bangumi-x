import { applyTheme, getCurrentDark } from "../../utils/page";

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
});
