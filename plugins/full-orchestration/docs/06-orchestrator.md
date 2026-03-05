# 06 — The `/swe` Orchestrator Skill

## Purpose

The `/swe` skill is the main entry point to the full-orchestration pipeline. It coordinates five stages — ticket intake, spec & design, TDD implementation, code review, and PR creation — managing state, gating progression on user approval, and handling errors and resumption.

You give it a ticket ID. It gives you a reviewed PR.

## Skill Specification

```yaml
---
name: swe
description: >-
  Run the full software engineering pipeline from ticket to PR.
  Use when starting a feature, fixing a bug from a ticket, or
  driving end-to-end development from a Jira, Linear, or GitHub
  issue. Accepts a ticket ID or URL as argument and orchestrates
  intake, spec design, TDD implementation, code review, and PR
  creation with approval gates at each stage.
---
```

### Invocation

```
/swe PROJ-123
/swe https://github.com/org/repo/issues/42
/swe PROJ-123 --from=implement
```

## Pipeline Flow

```
/swe PROJ-123
    │
    ├─ Stage 1: ticket-intake
    │   ├─ Fetch ticket from Jira / Linear / GitHub Issues
    │   ├─ Parse requirements and acceptance criteria
    │   └─ Present summary → User confirms ✓
    │
    ├─ Stage 2: spec-writer
    │   ├─ 2A  Explorer team fans out across codebase
    │   ├─ 2B  Spec architect synthesizes technical spec
    │   ├─ 2C  Review team (4 agents) evaluates spec
    │   ├─ 2D  Impl planner produces step-by-step plan
    │   ├─ 2E  Review team evaluates impl plan
    │   └─ Present spec + plan → User confirms ✓
    │
    ├─ Stage 3: tdd-engineer
    │   ├─ Work on current branch
    │   ├─ Write failing tests from spec
    │   ├─ Implement until tests pass
    │   ├─ Run full test suite
    │   └─ Present implementation → User confirms ✓
    │
    ├─ Stage 4: deep-review (external plugin)
    │   ├─ Skeptic, advocate, architect agents review diff
    │   ├─ Produce consolidated assessment
    │   ├─ If issues found → iterate with tdd-engineer
    │   └─ Present review → User confirms ✓
    │
    └─ Stage 5: pr-create
        ├─ Create PR via gh CLI with structured description
        ├─ Link original ticket
        ├─ Include review summary
        └─ Return PR URL ✓
```

## Stage Gating

Each stage skill owns its own approval gates — the orchestrator does not add additional prompts. When a stage skill returns successfully, the orchestrator marks the stage as completed in the state file and proceeds to the next stage.

| Stage | Skill | Approval gates within the skill |
|-------|-------|---------------------------------|
| 1 — Ticket Intake | `ticket_intake` | User confirms the parsed requirements summary |
| 2 — Spec & Design | `spec_writer` | User approves spec (2B), spec review (2C), impl plan (2D), impl review (2E) |
| 3 — TDD Implementation | `tdd_implement` | None (reports results; orchestrator proceeds) |
| 4 — Code Review | `code_review` | User chooses: Approve / Iterate (re-enter Stage 3) / Continue manually / Abort |
| 5 — PR Creation | `pr_create` | User confirms PR preview before creation |

If the user aborts within a stage, the skill reports the abort and the orchestrator saves state for later resumption.

## CLI Arguments

| Argument | Effect |
|----------|--------|
| `--from=STAGE` | Resume from a specific stage. Valid values: `intake`, `spec`, `implement`, `review`, `pr`. Reads saved state from the previous stages. |
| `--skip-review` | Skip Stage 4 code review. Proceeds directly from Stage 3 to Stage 5. |

### Running Individual Stages

Each stage can also be invoked as a standalone skill:

```
/ticket_intake PROJ-123                        # Stage 1 only
/spec_writer PROJ-123                          # Stage 2 only (reads ticket state)
/spec_review .claude/specs/PROJ-123.md         # Run just the review team on an existing spec
```

When run standalone, stages read whatever state is available and produce their output without advancing the pipeline.

## Error Handling and Resumption

### State Persistence

The orchestrator saves pipeline state to disk after each stage completes:

```
.claude/swe-state/{ticket-id}.json
```

This state file contains:
- Current stage and status
- Ticket data (from Stage 1)
- Spec and implementation plan (from Stage 2)
- Branch name (from Stage 3)
- Review findings (from Stage 4)

### Resumption

If the pipeline fails or the user aborts mid-stage, it can be resumed:

```
/swe PROJ-123 --from=implement
```

The orchestrator loads saved state from `.claude/swe-state/PROJ-123.json` and picks up from the specified stage. All prior stage outputs are available to the resumed stage.

### Error Scenarios

| Error | Behavior |
|-------|----------|
| Stage skill fails | Report the error, save state, suggest `/swe ID --from=STAGE` to retry |
| External plugin unavailable | Report which plugin is missing and show install command |
| MCP server not configured | Show setup command for the detected ticketing system |
| Test suite fails in Stage 3 | The tdd-engineer iterates internally; only surfaces to the user if it cannot resolve after retries |
| Review finds critical issues | Stage 4 loops back to Stage 3 automatically (with user approval) |

## State Management

The orchestrator passes data between stages through the state file. Each stage reads inputs from prior stages and writes its own outputs.

| Stage | Reads | Writes |
|-------|-------|--------|
| 1 — Ticket Intake | Ticket ID (from CLI arg) | `ticket`: parsed requirements, acceptance criteria, affected areas |
| 2 — Spec & Design | `ticket` | `spec`: technical spec, `impl_plan`: implementation steps |
| 3 — TDD Implementation | `ticket`, `spec`, `impl_plan` | `branch`: name, `test_results`: pass/fail summary |
| 4 — Code Review | `branch` | `review`: consolidated findings, `approved`: boolean |
| 5 — PR Creation | `ticket`, `branch`, `review` | `pr_url`: the created PR URL |

### State File Structure

```json
{
  "ticket_id": "PROJ-123",
  "target_branch": "main",
  "current_stage": "implement",
  "status": "awaiting_approval",
  "stages": {
    "intake": {
      "completed": true,
      "ticket_file": ".claude/swe-state/PROJ-123/ticket.json"
    },
    "spec": {
      "completed": true,
      "spec_file": ".claude/specs/PROJ-123.md",
      "impl_plan_file": ".claude/specs/PROJ-123-impl.md",
      "context_file": ".claude/specs/PROJ-123-context.md",
      "explorers_run": 4,
      "spec_review_iterations": 1,
      "plan_review_iterations": 1
    },
    "implement": { "completed": false, "branch": null, "test_results": null },
    "review": { "completed": false, "approved": false, "iterations": 0, "findings": null },
    "pr": { "completed": false, "pr_number": null, "pr_url": null }
  }
}
```

## Cross-References

- [00 — System Overview](00-overview.md) — Architecture and pipeline diagram
- [01 — Ticket Intake](01-ticket-intake.md) — Stage 1 details
- [02 — Spec & Design](02-spec-design.md) — Stage 2 details
- [03 — TDD Implementation](03-tdd-implementation.md) — Stage 3 details
- [04 — Code Review](04-code-review.md) — Stage 4 details
- [05 — PR Creation](05-pr-creation.md) — Stage 5 details
- [07 — Plugin Components](07-plugin-components.md) — Full inventory of skills, agents, and hooks
- [08 — Setup Guide](08-setup-guide.md) — Installation and configuration
