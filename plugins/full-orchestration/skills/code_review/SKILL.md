---
name: code_review
description: "Run adversarial code review on a TDD implementation. Use when you have a completed implementation branch ready for review before PR creation. Delegates to the deep-review plugin for parallel three-agent analysis, classifies findings by severity, auto-fixes minor issues, and gates approval."
---

# Code Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Adversarial multi-agent review of the implementation, with an iterate loop for fixes.

## Usage

```
/code_review <ticket-id>
```

---

## Phase 1: Validate

Read state. Confirm `stages.implement.completed` is true. Extract `feature_branch` and `target_branch`. Verify feature branch exists. Report: ticket ID, branches, strategy (max 3 iterations).

If `/deep_review` is unavailable: stop and show `/plugin install deep-review@ghcp-dev-plugin`.

---

## Phase 2: Review Iteration Loop

Repeat up to **3 iterations**:

### 2.1 Diff and Review

```bash
git diff {target_branch}...{feature_branch}
```

If empty, skip to approval gate. Otherwise:

```
/deep_review --base={target_branch} --head={feature_branch}
```

### 2.2 Parse Findings

Parse `<!-- structured-findings ... -->` from deep-review output. Schema contract (synchronized with `deep_review`):

| Field | Type | Values |
|---|---|---|
| `id` | int | Sequential from 1 |
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `file` | string | Relative path |
| `line` | int/null | Line number |
| `summary` | string | One-line description |
| `agents` | list | `advocate`, `skeptic`, `architect` |

Fallback: extract from `**Priority**: ...` lines if block missing.

Map priorities: Critical→Critical (blocks merge), High→Major (user decides), Medium→Minor (auto-fix), Low→Suggestion (follow-up).

### 2.3 Present and Handle

Show findings grouped by severity. For each:
- **Critical**: user chooses fix or dismiss with rationale
- **Major**: user chooses fix, defer, or dismiss
- **Minor**: auto-fix; if fails, demote to suggestion
- **Suggestion**: collect for follow-up

### 2.4 Apply Fixes

If fixes needed, spawn TDD engineer with scoped prompt:

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  Applying review fixes on {feature_branch}.
  Findings to fix:
  {list with file:line references}

  For each: write/update test, apply fix, run tests, commit.
  Do NOT modify beyond scope of these fixes.
  Write results to: .claude/swe-state/{ticket-id}/review-fixes-{N}.md
```

### 2.5 Iterate or Continue

If iteration < 3 and fixes applied → re-review (step 2.1). If iteration = 3 or no fixes needed → approval gate. Save each iteration to `.claude/swe-state/{ticket-id}/review-iteration-{N}.md`.

---

## Phase 3: Approval Gate

Present: iterations, resolved/remaining counts, follow-up items, test status.

Warn if critical findings remain unresolved.

User chooses:
- **Approve** → proceed to Stage 5
- **Iterate** → spawn TDD engineer with full context (see below), then return to Phase 2
- **Abort** → stop pipeline

Write final summary to `review_summary_file` path from state.

### Iterate: Full-Context TDD Engineer

Capture user direction verbatim. Spawn with file references (not inlined content):

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  Iterating on implementation based on code review feedback.

  Original inputs:
    Spec:        {spec_file from state}
    Plan:        {impl_plan_file from state}
    Context:     {context_file from state}

  Previous implementation:
    Summary:     {impl_summary_file from state}

  Review feedback:
    Full review: {review_summary_file from state}

  User direction:
    {verbatim user instruction}

  Read review and impl summary to understand what needs to change.
  Use TDD. Keep all existing tests passing.
  Commit: "review: fix {severity} — {description}"
  Run full suite when done.
  Write updated summary to: {impl_summary_file from state}
```

Return to Phase 2 after completion.

---

## Phase 4: Update State

- **Approve** → `stages.review.completed = true`, `stages.review.approved = true`, populate findings counts
- **Abort** → `stages.review.approved = false`, `status = "aborted"`
