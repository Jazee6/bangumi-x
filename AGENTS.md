## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.

## 项目规则

- 已安装reactCompiler，减少不必要代码
- 功能尽量满足Cloudflare Free Tier使用
- 1.0版本之前为开发阶段，无需考虑线上
- 上游OpenAPI：https://bangumi.github.io/api/dist.json
- mini使用skyline渲染，务必注意与webview的差异，尽量使用skyline相关组件
- mini交互针对移动端优化，组件样式和web对齐，同步到mini的components/ui
- mini也使用lucide图标