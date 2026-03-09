# 04 — Code Review (within Implement & Review)

## Purpose

The review phase subjects the implementation to adversarial, multi-perspective code review. Multiple review agents examine the full branch diff independently, surface issues from different angles, and produce a consolidated assessment. The `implement_and_review` skill then drives a fix loop — auto-fixing Minor and Major findings with full state context, escalating Critical ones to the user, and re-reviewing until convergence or cap.

This phase is the second half of the `implement_and_review` skill (Stage 3). It begins after the TDD implementation phase completes (see [03 — TDD Implementation](03-tdd-implementation.md)).

The goal: catch bugs, security holes, and architectural missteps **before** they reach a human reviewer in the PR.

---

## deep-review Plugin Integration

The `deep-review` plugin spawns three agents in parallel, each reading a shared context file:

| Agent | Role | Focus |
|-------|------|-------|
| **Skeptic** (opus) | Find flaws | Bugs, edge cases, failure modes, code smells that indicate deeper problems |
| **Advocate** (opus) | Defend intent | Design rationale, trust boundaries, false-positive defense, flags genuine uncertainties |
| **Architect** | Evaluate direction | System-level impact, structural patterns, technical debt trajectory |

Each agent produces an independent analysis. The orchestrator (within `deep-review`) synthesizes these into a consolidated review using evidence-based conflict resolution — `file:line` citations beat assertions.

For full details on how context is gathered, agents are spawned, and synthesis works, see the [deep-review skill documentation](../../deep-review/skills/deep_review/SKILL.md).

---

## Review-Fix Loop

The review-fix loop follows the same author→reviewer→fix structure as the 2B↔2C spec review-fix loop: an author (TddEngineer) produces work, a reviewer (deep-review) evaluates it, the author fixes, and the reviewer re-evaluates — repeating until convergence or cap. The key difference is convergence criteria: spec review converges on 0 OPEN comments (all comments block), while code review converges on 0 Critical + 0 Major + 0 Minor (Suggestions are non-blocking).

Every review iteration is a **full-branch review** (`target_branch...feature_branch`). No incremental snapshots are needed — this matches how `spec_review` re-reads the full document each iteration.

```
┌──────────────────────────────────────┐
│  Review-Fix Loop (max 5 rounds)      │
│                                      │
│  /deep_review --base={target}        │◄──────────┐
│               --head={feature}       │           │
│                                      │           │
│  Parse structured-findings           │           │
│  Map priorities → severity           │           │
│  Write to review_iteration_file      │           │
└──────────────┬───────────────────────┘           │
               │                                    │
        ┌──────┴──────┐                             │
        │             │                             │
   Converged     Findings                           │
   (0 C/M/Mi)        │                             │
        │      ┌──────┴──────────┐                  │
        │      │ Critical → user │                  │
        │      │ Major → auto-fix│                  │
        │      │ Minor → auto-fix│                  │
        │      └──────┬──────────┘                  │
        │             │                             │
        │      TddEngineer fixes                    │
        │      (with full state context:            │
        │       spec, plan, context,                │
        │       impl summary, review)               │
        │             │                             │
        │      iteration < 5? ─── Yes ──────────────┘
        │             │
        │          No (capped)
        │             │
        ▼             ▼
┌──────────────────────────────────────┐
│  Approval Gate (always)               │
│  User: approve / iterate / abort     │
└──────────────────────────────────────┘
```

### How It Works

1. **Full branch review**: `implement_and_review` runs `/deep_review --base={target_branch} --head={feature_branch}` to review the complete diff. On failure, retry once; second failure breaks the loop with a warning.

2. **Parse and classify**: Structured findings are extracted from the `<!-- structured-findings -->` block. Priorities are mapped: Critical→Critical, High→Major, Medium→Minor, Low→Suggestion. Results are written to `review_iteration_file`.

3. **Convergence check**: If 0 Critical + 0 Major + 0 Minor → converged, exit loop.

4. **Handle by severity**:
   - **Critical**: Pause the loop. Present to user with options per-Critical: fix (with direction), dismiss (with rationale), or abort.
   - **Major + Minor**: Queue for auto-fix.

5. **Auto-fix with full context**: TddEngineer is spawned with a state file reference, giving it access to the original spec, implementation plan, codebase context, impl summary, and review feedback — not just the scoped finding list. This ensures fixes are informed by the full design context.

6. **Loop**: Continue until converged or iteration cap (5 rounds).

---

## Severity Rating System

All findings are classified into one of four severity levels:

| Severity | Meaning | Action |
|----------|---------|--------|
| **Critical** | Must fix before merge | Security vulnerabilities, data loss risks, correctness bugs with user-facing impact |
| **Major** | Should fix | Logic errors, missing error handling, race conditions, broken edge cases |
| **Minor** | Nice to fix | Naming inconsistencies, style deviations, minor performance optimizations |
| **Suggestion** | Consider for future | Refactoring ideas, alternative approaches, patterns that could improve maintainability |

### How severities drive the loop

- **Critical** findings break the auto-loop. The skill pauses immediately and presents Critical findings for user decision: fix (with direction), dismiss (with rationale), or abort. Dismissed Criticals are recorded in state.
- **Major** findings are auto-fixed by TddEngineer with full state context. No user input required — the re-review in subsequent iterations validates the fix.
- **Minor** findings are auto-fixed. If auto-fix fails, they are demoted to suggestions.
- **Suggestions** are collected into a "Follow-up Items" section and do not block convergence.

---

## Approval Gate

After the review-fix loop completes (converged or capped), `implement_and_review` **always** presents a summary and waits for explicit user approval before proceeding to [Stage 4: PR Creation](05-pr-creation.md).

The approval prompt includes:
- Iterations completed and phase reached (converged / capped)
- Findings breakdown: resolved, auto-fixed, remaining, dismissed (with rationale)
- Follow-up items (suggestions collected across all iterations)
- Confirmation that all tests still pass after review fixes

User chooses:
- **Approve** — proceed to Stage 4
- **Iterate** — spawn TddEngineer with full context + user direction, return to review-fix loop (counter continues, does not reset)
- **Abort** — stop pipeline

---

## Cross-References

- [deep-review plugin](../../deep-review/skills/deep_review/SKILL.md) — the review engine used in this phase
- [03 — TDD Implementation](03-tdd-implementation.md) — the implementation phase that precedes this; TddEngineer handles both initial implementation and review fixes
- [05 — PR Creation](05-pr-creation.md) — consumes the approved review output
- [00 — System Overview](00-overview.md) — full pipeline architecture
