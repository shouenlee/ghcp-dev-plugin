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
/swe PROJ-123 --skip-spec
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
    │   ├─ Create isolated git worktree
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
    └─ Stage 5: pr-create (external plugin)
        ├─ Create PR with structured description
        ├─ Link original ticket
        ├─ Include review summary
        └─ Return PR URL ✓
```

## Stage Gating

Every stage transition is an **approval gate**. The orchestrator pauses, displays the stage output, and waits for explicit user confirmation before moving to the next stage.

| Gate | What the user sees | Options |
|------|--------------------|---------|
| After Stage 1 | Parsed ticket summary with requirements and affected areas | Approve / Edit requirements / Abort |
| After Stage 2 | Technical spec and implementation plan | Approve / Request changes / Abort |
| After Stage 3 | Implementation diff and test results | Approve / Request changes / Abort |
| After Stage 4 | Review assessment with findings | Approve / Iterate (re-enter Stage 3) / Abort |
| After Stage 5 | PR URL | Done |

If the user requests changes at any gate, the orchestrator re-runs the current stage with the feedback incorporated and presents the output again.

## CLI Arguments

| Argument | Effect |
|----------|--------|
| `--skip-spec` | Skip Stage 2 entirely. Use when a spec already exists or for small, well-understood changes. The orchestrator jumps from Stage 1 directly to Stage 3. |
| `--from=STAGE` | Resume from a specific stage. Valid values: `intake`, `spec`, `implement`, `review`, `pr`. Reads saved state from the previous stages. |
| `--skip-review` | Skip Stage 4 code review. Proceeds directly from Stage 3 to Stage 5. |

### Running Individual Stages

Each stage can also be invoked as a standalone skill:

```
/ticket-intake PROJ-123       # Stage 1 only
/spec-writer                  # Stage 2 only (reads ticket state)
/spec-review                  # Run just the review team on an existing spec
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
- Worktree path and branch name (from Stage 3)
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
| 3 — TDD Implementation | `ticket`, `spec`, `impl_plan` | `worktree`: path, `branch`: name, `test_results`: pass/fail summary |
| 4 — Code Review | `branch`, `worktree` | `review`: consolidated findings, `approved`: boolean |
| 5 — PR Creation | `ticket`, `branch`, `review` | `pr_url`: the created PR URL |

### State File Structure

```json
{
  "ticket_id": "PROJ-123",
  "current_stage": "implement",
  "status": "awaiting_approval",
  "stages": {
    "intake": { "completed": true, "ticket": { "..." } },
    "spec": { "completed": true, "spec": { "..." }, "impl_plan": { "..." } },
    "implement": { "completed": false, "worktree": null, "branch": null },
    "review": { "completed": false },
    "pr": { "completed": false }
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
