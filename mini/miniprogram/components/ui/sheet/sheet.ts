interface WorkletApi {
  runOnJS<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void;
  shared<T>(value: T): { value: T };
}

// wx.worklet 仅在支持 Skyline 的基础库上存在；缺失时退化为普通调用，避免模块加载即报错。
const { runOnJS, shared }: WorkletApi = (wx as unknown as { worklet?: WorkletApi }).worklet ?? {
  runOnJS: (fn) => fn,
  shared: (value) => ({ value }),
};

// draggable-sheet 的最小尺寸为 0.1；下拉松手后吸附到最小尺寸即视为关闭。
const DISMISS_SIZE = 0.12;

interface SheetState {
  dismissing: { value: boolean };
}

interface DraggableSheetNode {
  scrollTo(options: { size: number; animated: boolean }): void;
}

Component({
  options: { multipleSlots: true },
  properties: {
    open: { type: Boolean, value: false },
    footerVisible: { type: Boolean, value: true },
    initialSize: { type: Number, value: 0.6 },
    title: { type: String, value: "" },
  },
  data: {
    snapSizes: [0.6, 0.92],
  },
  observers: {
    initialSize(size: number) {
      this.setData({ snapSizes: [size, 0.92] });
    },
    // page-container 隐藏时不卸载内容，下拉关闭后尺寸停在最小值；重新打开前先恢复初始尺寸，
    // 恢复完成前保持 dismissing，避免残留的最小尺寸立即再次触发关闭。
    open(open: boolean) {
      const { dismissing } = this as unknown as Partial<SheetState>;
      if (!open || !dismissing) return;
      dismissing.value = true;
      this.createSelectorQuery()
        .select(".ui-sheet__draggable")
        .node()
        .exec((result: Array<{ node?: DraggableSheetNode } | null>) => {
          result[0]?.node?.scrollTo({ size: this.data.initialSize, animated: false });
          dismissing.value = false;
        });
    },
  },
  lifetimes: {
    created() {
      (this as unknown as SheetState).dismissing = shared(false);
    },
  },
  methods: {
    onClose() {
      if (this.data.open) this.triggerEvent("close");
    },
    onBeforeLeave() {
      // The system back gesture can dismiss page-container without changing `open`.
      this.onClose();
    },
    onAfterLeave() {
      if (this.data.open) {
        // A system back gesture can finish even when the page rejected `close`.
        this.triggerEvent("dismiss");
      } else {
        this.triggerEvent("closed");
      }
    },
    onContentTap() {},
    // 在 UI 线程上跟随拖拽尺寸，只在第一次到达关闭阈值时回到 JS 线程关闭。
    onSizeUpdate(event: { size: number }) {
      "worklet";
      // 不解构 this：worklet 捕获解构结果时会冻结对象。
      if (event.size > DISMISS_SIZE || (this as unknown as SheetState).dismissing.value) return;
      (this as unknown as SheetState).dismissing.value = true;
      runOnJS(this.onClose.bind(this))();
    },
  },
});
