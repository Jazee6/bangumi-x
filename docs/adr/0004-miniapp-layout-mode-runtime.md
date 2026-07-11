# MiniApp 大屏适配：运行时 LayoutMode 感知（非 CSS media query）

## Status

Accepted

## Context

MiniApp（`./mini`）需要适配大屏设备（平板竖屏、折叠屏展开态）。web 端用 Tailwind 的响应式断点（`sm:`/`md:`/`lg:`）做适配，但 MiniApp 使用 Skyline 渲染引擎，**Skyline 不支持 CSS `@media` 媒体查询**（官方社区明确回答「media query 暂时还不支持」，特性状态页标注为「规划中」）。`match-media` 组件在 Skyline 下也标记为「待考虑」。

因此无法用声明式 CSS 断点实现响应式布局，必须改用运行时感知：JS 侧获取窗口尺寸，计算 LayoutMode，`setData` 给页面，WXSS 用 class 选择器区分样式。

## Decision

引入 **LayoutMode**（`compact | expanded`）作为 MiniApp 的布局维度，与 ThemeMode 正交。判定逻辑：`windowWidth >= 600 && deviceType !== 'phone'`（600px 是 Material Design 断点，排除手机横屏）。

实现机制对齐现有 ThemeMode 模式：

- `app.ts` 在 `onLaunch` 时算一次 LayoutMode，存 `globalData.layoutMode`；预留 `wx.onWindowResize` 监听（MVP 阶段 `pageOrientation: portrait` 不触发，Phase 2 开放横屏后生效）。
- `utils/layout.ts` 提供 `getCurrentLayout()` + `applyLayout()`，与 `utils/page.ts` 的 `getCurrentDark()` + `applyTheme()` 模式完全对齐。
- 页面 `onShow` 调 `applyLayout.call(this)`，根 view 加 `expanded` class（与 `dark` class 并列）。
- WXSS 用 `.expanded .header { flex-direction: row }` 等选择器区分样式。

MVP 范围（Phase 1）：
- 列表页 `grid-view` 不动（`max-cross-axis-extent` 本身声明式自适应）。
- 三个详情页（Subject/Character/Person）header 在 expanded 模式下横排，info `max-width: 480px`。
- tabs、内容区、tabBar、导航模型不动。

Phase 2（暂不实施）：开放 `pageOrientation: auto`，`onResize` 生效，横屏适配，tabs/内容区限宽，tabBar 改侧边栏。

## Consequences

- 每个页面 `data` 需加 `expanded: false`，`onShow` 需调 `applyLayout.call(this)`（与 `applyTheme.call(this)` 并列）。
- 根 view 模板从 `class="page {{dark ? 'dark' : ''}}"` 变为 `class="page {{dark ? 'dark' : ''}} {{expanded ? 'expanded' : ''}}"`。
- `app.ts` globalData 多一个 `layoutMode` 字段。
- Skyline 未来若支持 media query，此方案可逐步迁移到声明式，但 LayoutMode 的领域概念不变（只是实现方式变了）。

## Alternatives considered

- **CSS `@media` 媒体查询**：不可行，Skyline 不支持。
- **`match-media` 组件**：不可行，Skyline 下标记为「待考虑」。
- **纯 `grid-view` max-cross-axis-extent，放弃详情页 header 适配**：可行但 MVP 价值减半，详情页 header 在平板上留白严重。
- **多档断点（sm/md/lg）**：MVP 不需要，单档 compact/expanded 足够，Phase 2 视需要扩展。
