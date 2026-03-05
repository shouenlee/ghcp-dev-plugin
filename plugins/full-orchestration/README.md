# full-orchestration

Fully agentic software engineering pipeline for Claude Code. Takes a ticket ID and drives it through five stages — ticket intake, technical spec & design, TDD implementation, code review, and PR creation — with human-in-the-loop approval gates at each stage.

## Quick Start

```
# Install the plugin
/plugin install full-orchestration@ghcp-dev-plugin

# Run the full pipeline
/swe PROJ-123
```

## Pipeline Stages

| Stage | What | How |
|-------|------|-----|
| 1. Ticket Intake | Fetch & parse requirements | MCP (Jira/Linear) or `gh` CLI |
| 2. Spec & Design | Explore codebase, write spec, review | Team of explorer + architect + reviewer agents |
| 3. TDD Implementation | Tests first, then implement | `tdd-engineer` agent on feature branch |
| 4. Code Review | Multi-perspective adversarial review | Reuses `deep-review` plugin agents |
| 5. PR Creation | Create PR, link ticket | `gh` CLI |

Each stage has an approval gate — you review and confirm before proceeding.

## Documentation

Comprehensive documentation lives in [`docs/`](docs/):

- [00 — System Overview](docs/00-overview.md)
- [01 — Ticket Intake](docs/01-ticket-intake.md)
- [02 — Spec & Design](docs/02-spec-design.md)
- [03 — TDD Implementation](docs/03-tdd-implementation.md)
- [04 — Code Review](docs/04-code-review.md)
- [05 — PR Creation](docs/05-pr-creation.md)
- [06 — Orchestrator Skill](docs/06-orchestrator.md)
- [07 — Plugin Components](docs/07-plugin-components.md)
- [08 — Setup Guide](docs/08-setup-guide.md)
- [09 — Improvements & Future Ideas](docs/09-improvements.md)

## Plugin Components

- **Skills:** `swe` (orchestrator), `ticket_intake`, `spec_writer`, `spec_review`
- **Agents:** `spec-architect`, `impl-planner`, `tdd-engineer`, `maintainability-reviewer`, `security-reviewer`, `efficiency-reviewer`, `completeness-reviewer`
- **Hooks:** Contextual suggestions for ticket and commit workflows

## Dependencies

This plugin reuses existing plugins rather than duplicating functionality:

- [`deep-review`](../deep_review/) — Stage 4 code review agents
