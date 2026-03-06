# Auto-Converging Review Loop

**Date:** 2026-03-05
**Status:** Approved
**Scope:** `full-orchestration` plugin — Stage 4 (Code Review)

---

## Problem

The current Stage 4 review loop runs a fixed 3 iterations, then asks the user to approve, iterate, or abort. There is no automatic convergence — the loop doesn't detect when all actionable findings are resolved. Minor and Major findings require the same user intervention as Critical ones, creating unnecessary friction.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auto-approve when clean? | No — always require human confirmation | Safety over speed |
| Max auto-iterations | 5 (up from 3) | More room to converge before escalating |
| Auto-fix scope | Minor + Major (only Critical needs user) | Maximizes autonomy while gating on security/correctness |
| Finding tracking | Diff-scoped re-review | Re-review only the changes from fixes, not the full branch diff |
| Overall structure | Two-Phase: Full + Incremental + Final Validation | Final full review catches interaction bugs missed by incremental |

## Architecture

### Three-Phase Review

```
Phase A: Initial Full Review
├── git diff {target}...{feature}  (full branch diff)
├── /deep_review on full diff
├── Parse findings → classify severity
├── Critical findings → STOP, present to user for decision
├── Major + Minor → auto-fix via TddEngineer
└── Record snapshot: last_review_commit = git rev-parse HEAD

Phase B: Incremental Fix Loop (iterations 2–5)
├── git diff {last_review_commit}...HEAD  (only fix changes)
├── /deep_review on incremental diff
├── If 0 Critical + 0 Major + 0 Minor → CONVERGED → Phase C
├── Critical → STOP, present to user for decision
├── Major + Minor → auto-fix via TddEngineer
├── Update snapshot: last_review_commit = HEAD
└── If iteration = 5 and not converged → hard stop → user gate

Phase C: Final Validation Review
├── git diff {target}...{feature}  (full branch diff again)
├── /deep_review on full diff
├── 0 Critical + 0 Major → CLEAN
├── Findings remain → present to user with iteration context
└── Always require user approval

User Gate (always reached):
├── Approve → Stage 5 (PR creation)
├── Iterate → TddEngineer with user direction → back to Phase B
└── Abort → stop pipeline
```

### Critical Finding Handling

Critical findings break the auto-loop at any phase:

1. Stop immediately
2. Present all findings (Critical highlighted at top)
3. User chooses per-Critical: **fix** (with direction), **dismiss** (with rationale), or **abort**
4. Fix: spawn TddEngineer with user direction, resume loop
5. Dismiss: record in state with rationale, continue loop

The loop is fully autonomous for Minor+Major but human-in-the-loop for Critical.

### Convergence Criteria

The incremental loop converges when a re-review of only the fix diff returns:
- 0 Critical
- 0 Major (High)
- 0 Medium (Minor)

Suggestions (Low) do NOT block convergence — collected for the PR description.

Phase C (final validation) is a safety net. If it finds new Critical/Major that incremental missed (interaction bugs), it pauses for user input rather than re-entering the loop.

## State Changes

New and modified fields in `.claude/swe-state/{ticket-id}.json`:

```json
{
  "stages": {
    "review": {
      "completed": false,
      "approved": false,
      "last_review_commit": "abc123def",
      "iterations": 3,
      "phase": "initial | incremental | validation | capped | complete",
      "findings": {
        "critical": { "total": 0, "fixed": 0, "dismissed": 0 },
        "major": { "total": 1, "fixed": 0, "auto_fixed": 1, "deferred": 0, "dismissed": 0 },
        "minor": { "total": 3, "fixed": 0, "auto_fixed": 3 },
        "suggestions": 2,
        "dismissed": [
          { "id": 1, "severity": "critical", "summary": "...", "rationale": "..." }
        ]
      }
    }
  }
}
```

New fields: `last_review_commit`, `phase`, `auto_fixed` (nested in major/minor), `dismissed` array.

## Files to Modify

| File | Change |
|---|---|
| `plugins/full-orchestration/skills/code_review/SKILL.md` | Rewrite Phase 2 with three-phase loop, update convergence logic, auto-fix Major, raise iteration cap to 5 |
| `plugins/full-orchestration/docs/04-code-review.md` | Update iteration loop diagram, severity action table, add Phase C description |
| `plugins/full-orchestration/docs/10-data-models-and-context.md` | Add new state fields (`last_review_commit`, `phase`, `auto_fixed`, `dismissed`) |

## Sequence Diagram

```
Orchestrator          deep-review          TddEngineer         User
    │                     │                     │                │
    │── Phase A: full diff ──►                  │                │
    │                     │── findings ──►      │                │
    │                     │                     │                │
    │  [if Critical] ─────────────────────────────────► decision │
    │  ◄──────────────────────────────────────────────── fix/dismiss
    │                     │                     │                │
    │  [Major+Minor] ────────────────────►fix   │                │
    │                     │              ◄──done │                │
    │  record snapshot    │                     │                │
    │                     │                     │                │
    │── Phase B: fix diff ──►                   │                │
    │                     │── findings ──►      │                │
    │  [converged?]       │                     │                │
    │  no ── auto-fix ───────────────────►fix   │                │
    │                     │              ◄──done │                │
    │  (repeat up to iteration 5)               │                │
    │                     │                     │                │
    │── Phase C: full diff ──►                  │                │
    │                     │── findings ──►      │                │
    │                     │                     │                │
    │──────── summary + approval gate ──────────────────► decide │
    │  ◄───────────────────────────────────────────── approve/iterate/abort
    │                     │                     │                │
```
