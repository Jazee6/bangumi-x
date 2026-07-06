import { ICON_CHEVRON_RIGHT_LIGHT, ICON_CHEVRON_RIGHT_DARK } from "../../utils/icons";

Component({
  properties: {
    id: { type: Number, value: 0 },
    title: { type: String, value: "" },
    description: { type: String, value: "" },
    image: { type: String, value: "" },
    arrow: { type: Boolean, value: true },
    dark: { type: Boolean, value: false },
  },
  data: {
    chevronIcon: ICON_CHEVRON_RIGHT_LIGHT,
  },
  observers: {
    dark(d: boolean) {
      this.setData({ chevronIcon: d ? ICON_CHEVRON_RIGHT_DARK : ICON_CHEVRON_RIGHT_LIGHT });
    },
  },
});
