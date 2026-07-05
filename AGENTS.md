<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `bunx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `bunx @tanstack/intent@latest load <package>#<skill>`
  and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for
  the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional
  skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo (no external tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Verification

Before finishing a task, run from the repo root:

- Lint: `bun run lint`
- Typecheck web: `cd web && ./node_modules/.bin/tsc --noEmit`
- Typecheck server: `cd server && ./node_modules/.bin/tsc --noEmit`
