import { AD_UNIT_ID } from "../../../lib/config";

// 仅内容浏览页页尾使用；加载失败或用户关闭后整块折叠，ID 为空时不渲染。
Component({
  properties: {
    visible: { type: Boolean, value: true },
  },
  data: {
    unitId: AD_UNIT_ID,
    hidden: false,
  },
  methods: {
    onHide() {
      this.setData({ hidden: true });
    },
  },
});
