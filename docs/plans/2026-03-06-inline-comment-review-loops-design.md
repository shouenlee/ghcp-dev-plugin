# Inline Comment Review Loops for Stage 2

**Date:** 2026-03-06
**Status:** Approved
**Scope:** `full-orchestration` plugin — Stage 2 (Spec & Design)

---

## Problem

The current Stage 2 review flow produces separate review docs (`-review-spec.md`, `-review-impl.md`) and requires the user to manually mediate between reviewer findings and the spec/impl doc. The user must read findings, decide what to address, update the doc, and re-run the review. This creates friction and requires the user to be deeply involved in what should be a mechanical review-fix cycle.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| User involvement | Fully autonomous loop; user sees only the final result | Minimize friction; user approves polished output |
| Comment format | Blockquote markers (visible in rendered markdown) | Easy to scan, grep-able, no hidden state |
| Comment resolution | Mark as RESOLVED (not deleted) | Reviewers can verify fixes before removal |
| Max iterations | 5 rounds (match Stage 4) | Consistent cap across pipeline |
| Loop owner | `spec_writer` skill | Keeps spec_review as a pure review tool; orchestrator owns the loop |
| Separate review docs | Eliminated | Comments live inline; no separate files needed |

## Architecture

### New Stage 2 Flow

```
2A: Codebase Exploration (unchanged)
    → {ticket-id}-context.md

2B: SpecArchitect writes spec
    → {ticket-id}.md

2B↔2C: Autonomous Review-Fix Loop (max 5 rounds)
    ┌─────────────────────────────────────────────────┐
    │  spec_review: 4 reviewers add inline OPEN       │
    │  comments directly in {ticket-id}.md            │
    │       ↓                                         │
    │  Converged? (0 OPEN comments) → exit            │
    │       ↓ no                                      │
    │  SpecArchitect: reads comments, fixes doc,      │
    │  marks addressed comments RESOLVED              │
    │       ↓                                         │
    │  spec_review: re-reviews                        │
    │  - Verify RESOLVED → remove satisfied ones      │
    │  - Reopen inadequately resolved → OPEN          │
    │  - Add new OPEN comments if needed              │
    │       ↓                                         │
    │  (repeat until converged or cap)                │
    └─────────────────────────────────────────────────┘
    → spec_writer strips remaining RESOLVED markers
    → User sees clean spec, approves

2D: ImplPlanner writes impl plan
    → {ticket-id}-impl.md

2D↔2E: Same loop pattern (max 5 rounds)
    ┌─────────────────────────────────────────────────┐
    │  spec_review: reviewers comment on impl plan    │
    │  ImplPlanner: addresses comments                │
    │  (same loop mechanics)                          │
    └─────────────────────────────────────────────────┘
    → spec_writer strips remaining RESOLVED markers
    → User sees clean impl plan, approves
    → Stage 3
```

### User Gates

| Gate | What User Sees | Options |
|---|---|---|
| After 2B↔2C loop | Final clean spec (all review comments resolved and stripped) | Approve / Request changes |
| After 2D↔2E loop | Final clean impl plan (all review comments resolved and stripped) | Approve / Request changes (final gate before Stage 3) |

Two gates removed vs current flow (user no longer reviews raw reviewer findings).

## Inline Comment Format

### Format

```
> **[{SEVERITY} | {ReviewerName} | {STATUS}]** {comment text}
```

- **Severity**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- **Reviewer**: `MaintainabilityReviewer`, `SecurityReviewer`, `EfficiencyReviewer`, `CompletenessReviewer`
- **Status**: `OPEN`, `RESOLVED`

### Placement

Comments are inserted directly after the relevant paragraph or section in the document:

```markdown
## 3. Proposed Approach

We will use a sliding window algorithm for rate limiting...

> **[HIGH | SecurityReviewer | OPEN]** The sliding window approach doesn't
> account for distributed deployments. Race condition possible with shared
> Redis keys. Consider Redis Lua scripting for atomic operations.

> **[MEDIUM | EfficiencyReviewer | OPEN]** Sliding window stores per-request
> timestamps. Consider fixed-window counter for high-traffic endpoints.
```

### After Author Addresses

```markdown
## 3. Proposed Approach

We will use a sliding window algorithm with Redis Lua scripting for atomic
increment-and-check, ensuring correctness across distributed instances...

> **[HIGH | SecurityReviewer | RESOLVED]** The sliding window approach doesn't
> account for distributed deployments. Race condition possible with shared
> Redis keys. Consider Redis Lua scripting for atomic operations.
```

### Convergence

**Converged** = 0 comments with `OPEN` status in the document.

On re-review, reviewers:
- **Remove** RESOLVED comments they're satisfied with
- **Reopen** (change RESOLVED → OPEN) comments inadequately addressed
- **Add new** OPEN comments for issues introduced by the fixes

### Cleanup

After convergence, `spec_writer` strips all remaining `> **[...|RESOLVED]**` blockquotes before presenting to the user.

## `spec_review` Changes

### Current Behavior
1. Gather context → write `review-context.md`
2. Spawn 4 reviewers (Read, Grep only) → each produces findings text
3. Consolidate into separate review doc → report verdict

### New Behavior
1. Gather context (same detection of spec vs impl mode)
2. Spawn 4 reviewers with **Edit** tool → each inserts OPEN blockquote comments directly in the document
3. Count OPEN comments in document → report count + severity breakdown (no separate doc)

### Removed
- `review-context.md` (reviewers read the doc + ticket + context directly)
- Separate review output files (`-review-spec.md`, `-review-impl.md`)
- PASS/NEEDS REVISION verdict (replaced by OPEN comment count)

## Author Agent Fix Prompt

When `spec_writer` spawns the author agent to address review comments:

```
subagent_type: full-orchestration:SpecArchitect  # or ImplPlanner for impl mode
prompt: |
  Review comments have been added to: {doc_path}

  Read the document. For each comment marked OPEN:
  1. Understand the reviewer's concern
  2. Modify the relevant section to address it
  3. Change the comment status from OPEN to RESOLVED

  Do NOT delete comments. Do NOT add new content beyond addressing the comments.
  Do NOT change sections that have no comments.

  When done, report: number of comments addressed, any you couldn't resolve
  (with explanation).
```

## State Changes

### Removed Fields
- `stages.spec.spec_review_file` (no separate review doc)
- `stages.spec.impl_review_file` (no separate review doc)

### Removed Artifacts
- `.claude/specs/{ticket-id}-review-spec.md`
- `.claude/specs/{ticket-id}-review-impl.md`
- `.claude/swe-state/{ticket-id}/review-context.md`

### New Fields
```json
{
  "stages": {
    "spec": {
      "completed": false,
      "spec_review_iterations": 0,
      "impl_review_iterations": 0,
      "spec_file": ".claude/specs/PROJ-123.md",
      "impl_plan_file": ".claude/specs/PROJ-123-impl.md",
      "context_file": ".claude/specs/PROJ-123-context.md"
    }
  }
}
```

## Agent Tool Changes

Reviewer agents need Edit access to insert comments:

| Agent | Current Tools | New Tools |
|---|---|---|
| MaintainabilityReviewer | Read, Grep | Read, Grep, Edit |
| SecurityReviewer | Read, Grep | Read, Grep, Edit |
| EfficiencyReviewer | Read, Grep | Read, Grep, Edit |
| CompletenessReviewer | Read, Grep | Read, Grep, Edit |

SpecArchitect and ImplPlanner already have Write/Edit access.

## Files to Modify

| File | Change |
|---|---|
| `skills/spec_writer/SKILL.md` | Add review-fix loop logic for 2B↔2C and 2D↔2E, strip comments on convergence |
| `skills/spec_review/SKILL.md` | Change from separate doc to inline comments, add Edit to reviewer spawns, remove review-context.md |
| `agents/MaintainabilityReviewer.agent.md` | Add Edit tool, update instructions for inline comment format |
| `agents/SecurityReviewer.agent.md` | Add Edit tool, update instructions for inline comment format |
| `agents/EfficiencyReviewer.agent.md` | Add Edit tool, update instructions for inline comment format |
| `agents/CompletenessReviewer.agent.md` | Add Edit tool, update instructions for inline comment format |
| `docs/02-spec-design.md` | Update flow diagram, remove separate review docs, describe loops |
| `docs/10-data-models-and-context.md` | Remove review doc artifacts, add iteration count fields, update artifact map |
| `skills/swe/SKILL.md` | Update initial state to remove review file paths, add iteration count fields |
| `docs/00-overview.md` | Update Stage 2 description |

## Edge Cases

| Scenario | Handling |
|---|---|
| Author can't resolve a comment | Reports in output; comment stays OPEN; next review iteration sees it |
| Same comment reopened 3+ times | Counts toward iteration cap; if cap reached, escalate all remaining OPEN to user |
| Reviewers disagree (one removes, another reopens) | OPEN wins — if any reviewer has concerns, the comment stays |
| No comments on first review | Converged immediately; proceed to user gate |
| Cap reached with OPEN comments | Present remaining OPEN comments to user at the approval gate |
