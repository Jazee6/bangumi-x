# MiniApp 导航栏：自定义 navigation-bar 组件（非原生）

## Status

Accepted

## Context

MiniApp（`./mini`）使用 Skyline 渲染引擎。Skyline 强制要求每个页面 `navigationStyle: custom`，**不支持原生系统导航栏**（`navigationStyle: default` 会被 Skyline 忽略或报错）。这是 Skyline 与 WebView 的核心差异之一，参见 `.agents/skills/skyline-overview/references/migration/getting-started.md`。

最初 grilling 会话中倾向于用原生系统导航栏（`navigationStyle: default` + `navigationBarTitleText`），以减少自定义组件工作量和与系统 UI 一致。但查阅 Skyline 文档后确认此方案不可行。

## Decision

复用模板自带的 `components/navigation-bar/navigation-bar` 自定义组件，并扩展以适配：

- **tab 页**（首页/发现/我的）：无返回按钮，仅显示标题。
- **详情页**（subject/character/person）：显示返回按钮 + 动态标题。

`app.json` 保持 `"navigationStyle": "custom"`。每个页面 json 仍需 `"navigationStyle": "custom"` + `"disableScroll": true`（Skyline 要求）。

导航栏配色随主题切换：页面 onShow 调 `wx.setNavigationBarColor` 根据当前 ThemeMode 设置背景色与文字色。

## Consequences

- 所有页面顶部需引入 `navigation-bar` 组件并传 `title` / `back` props。
- 导航栏占位需手动处理 `statusBarHeight`（组件内部已用 `wx.getSystemInfoSync` 处理）。
- 暗黑模式下导航栏背景需通过 `wx.setNavigationBarColor` 动态设置（无法通过 wxss 控制）。
- 失去原生导航栏的自动返回手势（Skyline 有自己的返回手势，需确认兼容）。

## Alternatives considered

- **原生系统导航栏**：不可行，Skyline 不支持。
- **weui `mp-navigation-bar`**：可用但增加 weui 依赖面，且模板已有等价组件。
- **从零重写导航栏组件**：重复造轮子。
