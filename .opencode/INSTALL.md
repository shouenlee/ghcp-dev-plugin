# Installing ghcp-dev-plugins in OpenCode

Add this to your `opencode.json` in your project directory or `~/.config/opencode/opencode.json` for global installation:

```json
{
  "plugin": ["ghcp-dev-plugin@git+https://github.com/shouenlee/ghcp-dev-plugin.git"]
}
```

Restart OpenCode. The plugin will install automatically and register all skills and agents.

## What Gets Installed

**31 skills** across all plugins, including:

- `review` — code review for bugs, security, performance
- `commit_changes` — smart commit splitting by logical concern
- `pr-create`, `pr_review`, `pr_status`, `resolve_pr` — GitHub PR tools
- `deep_review` — adversarial multi-agent code review
- `ci_pipeline` — GitHub Actions generation and diagnosis
- `design_doc` — RFCs and ADRs
- `task_breakdown` — feature decomposition into subtasks
- `python_lint_fix` — ruff + mypy + bandit
- `api_docs` — FastAPI/DRF documentation generation
- `docker_compose` — Dockerfile and compose generation
- `dep_manager` — Python dependency management
- `release_notes` — changelog and GitHub release publishing
- `swe` — full agentic SWE pipeline (ticket → spec → TDD → review → PR)
- `wiki_architect` and 7 other deep-wiki skills

**16 agents**, including `Reviewer`, `Advocate`, `Skeptic`, `WikiArchitect`, `TddEngineer`, and more.

## Skill Names

Skills retain their original `snake_case` names (e.g., `commit_changes`, `api_docs`). One exception: `pr-create` (hyphenated) resolves a naming conflict between the `gh-pr-tools` and `full-orchestration` plugins.

## Notes

- `hooks.json` behaviors are not available in OpenCode (no equivalent hook system).
- Agents inherit the model from your top-level OpenCode config rather than pinning a specific model.
