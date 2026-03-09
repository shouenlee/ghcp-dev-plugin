# 06 — The `/swe` Orchestrator Skill

## Purpose

The `/swe` skill is the main entry point to the full-orchestration pipeline. It coordinates four stages — ticket intake, spec & design, implement & review, and PR creation — managing state and gating progression on user approval.

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
    ├─ Stage 3: implement-and-review
    │   ├─ TddEngineer implements plan using TDD
    │   ├─ Review-fix loop (max 5 rounds):
    │   │   ├─ deep-review analyzes full branch diff
    │   │   ├─ Parse findings, classify severity
    │   │   ├─ TddEngineer auto-fixes (with full state context)
    │   │   └─ Repeat until converged or capped
    │   └─ Present review → User confirms ✓
    │
    └─ Stage 4: pr-create
        ├─ Create PR via gh CLI with structured description
        ├─ Link original ticket
        ├─ Include review summary
        └─ Return PR URL ✓
```

## Stage Gating

Each stage skill owns its own approval gates and state writes. The orchestrator runs stages sequentially, passing control to each skill in turn.

| Stage | Skill | Approval gates within the skill |
|-------|-------|---------------------------------|
| 1 — Ticket Intake | `ticket_intake` | User confirms the parsed requirements summary |
| 2 — Spec & Design | `spec_writer` | User approves spec (2B↔2C), impl plan (2D↔2E) |
| 3 — Implement & Review | `implement_and_review` | User chooses: Approve / Iterate / Abort (after review-fix loop converges or caps) |
| 4 — PR Creation | `pr_create` | User confirms PR preview before creation |

If the user aborts within a stage, the skill reports the abort and the orchestrator exits.

## Error Handling

| Error | Behavior |
|-------|----------|
| Stage skill fails | Report the error and exit |
| External plugin unavailable | Report which plugin is missing and show install command |
| MCP server not configured | Show setup command for the detected ticketing system |
| Test suite fails in Stage 3 | The TddEngineer iterates internally; only surfaces to the user if it cannot resolve after retries |
| Review finds critical issues | Stage 3 pauses review-fix loop for user decision (fix/dismiss/abort) |

## State Management

The orchestrator passes data between stages through the state file. Each stage reads inputs from prior stages and writes its own outputs.

| Stage | Reads | Writes |
|-------|-------|--------|
| 1 — Ticket Intake | Ticket ID (from CLI arg) | `stages.intake.ticket_file` |
| 2 — Spec & Design | `stages.intake.ticket_file` | `stages.spec.spec_file`, `stages.spec.impl_plan_file`, `stages.spec.context_file` |
| 3 — Implement & Review | `stages.spec.*` files, `feature_branch`, `target_branch` | `stages.implement.*`, `stages.review.*` |
| 4 — PR Creation | `stages.intake.ticket_file`, `stages.review.review_summary_file` | `stages.pr.pr_url`, `stages.pr.pr_number` |

### State File Structure

See [10 — Data Models & Context Passing](10-data-models-and-context.md) for the full schema. The authoritative initial state is defined in the `/swe` skill (Phase 2, Step 4).

## Cross-References

- [00 — System Overview](00-overview.md) — Architecture and pipeline diagram
- [01 — Ticket Intake](01-ticket-intake.md) — Stage 1 details
- [02 — Spec & Design](02-spec-design.md) — Stage 2 details
- [03 — TDD Implementation](03-tdd-implementation.md) — Stage 3 implementation phase details
- [04 — Code Review](04-code-review.md) — Stage 3 review-fix loop details
- [05 — PR Creation](05-pr-creation.md) — Stage 4 details
- [07 — Plugin Components](07-plugin-components.md) — Full inventory of skills, agents, and hooks
- [08 — Setup Guide](08-setup-guide.md) — Installation and configuration
