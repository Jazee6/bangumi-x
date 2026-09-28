import { SEARCH_KEYWORD_MAX_LENGTH } from "share";

// 对应 web 的 KeywordSearchForm：输入框 + 搜索按钮；关键词校验与提交由页面处理。
Component({
  properties: {
    loading: { type: Boolean, value: false },
    value: { type: String, value: "" },
  },
  data: { maxlength: SEARCH_KEYWORD_MAX_LENGTH },
  methods: {
    onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      this.triggerEvent("input", { value: event.detail.value });
    },
    onSearch() {
      if (!this.properties.loading) this.triggerEvent("search");
    },
    onClear() {
      this.triggerEvent("clear");
    },
  },
});
