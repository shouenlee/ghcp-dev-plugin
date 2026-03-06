---
name: code_review
description: >-
  Run adversarial code review with auto-converging fix loop. Use when you
  have a completed implementation branch ready for review before PR
  creation. Delegates to deep-review for three-agent analysis, auto-fixes
  Minor and Major findings, pauses only on Critical, and runs a final
  validation review before gating user approval.
---

# Code Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Three-phase auto-converging review: full review → incremental fix loop → final validation → user approval.

## Usage

```
/code_review <ticket-id>
```

---

## Phase 1: Validate

Read state. Confirm `stages.implement.completed` is true. Extract `feature_branch` and `target_branch`. Verify feature branch exists.

Report: ticket ID, branches, strategy (three-phase: initial → incremental (max 5) → validation).

If `/deep_review` is unavailable: stop and show `/plugin install deep-review@ghcp-dev-plugin`.

Record initial snapshot: `last_review_commit = git rev-parse {target_branch}` (the base before any review fixes). Set `stages.review.phase = "initial"`.

---

## Phase 2A: Initial Full Review

### 2A.1 Full Diff and Review

```bash
git diff {target_branch}...{feature_branch}
```

If empty, skip to approval gate. Otherwise:

```
/deep_review --base={target_branch} --head={feature_branch}
```

### 2A.2 Parse Findings

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

Map priorities: Critical→Critical, High→Major, Medium→Minor, Low→Suggestion.

Write the consolidated review to `review_iteration_file` path from state (overwritten each iteration).

### 2A.3 Handle by Severity

- **Critical**: STOP the auto-loop. Present all findings with Critical highlighted at top. User chooses per-Critical: **fix** (with direction), **dismiss** (with rationale), or **abort**. If abort → Phase 4. If fix → spawn TddEngineer (see 2A.4), then re-parse. If dismiss → record in state `findings.dismissed` array with `{id, severity, summary, rationale}`, continue.
- **Major**: auto-fix via TddEngineer (2A.4). No user input needed.
- **Minor**: auto-fix via TddEngineer (2A.4). If fix fails, demote to suggestion.
- **Suggestion**: collect for follow-up.

### 2A.4 Apply Fixes

Collect all Major + Minor findings (and any user-directed Critical fixes). Spawn TDD engineer:

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  Applying review fixes on {feature_branch}.
  Findings to fix:
  {list with file:line references and severity}

  For each: write/update test, apply fix, run tests, commit.
  Commit message: "review: fix {severity} — {description}"
  Do NOT modify beyond scope of these fixes.
```

**On TddEngineer failure**: If the agent errors or reports it cannot fix a finding: demote Minor findings to Suggestion (non-blocking). For Major findings, present the failure to the user with options: **retry** (with additional direction), **dismiss** (with rationale), or **abort**. Do not silently swallow failures.

### 2A.5 Record Snapshot

After fixes are committed: `last_review_commit = git rev-parse HEAD`. Update state. Set `stages.review.phase = "incremental"`. Increment `stages.review.iterations`. Proceed to Phase 2B.

If no actionable findings (only suggestions) → skip to Phase 2C.

---

## Phase 2B: Incremental Fix Loop

Repeat until converged or iteration cap (5 total iterations including Phase 2A):

### 2B.1 Pre-Diff Checks

**Rebase guard**: Verify `last_review_commit` is reachable: `git merge-base --is-ancestor {last_review_commit} HEAD`. If unreachable (exit code 1), the branch was rebased — reset snapshot to target branch: `last_review_commit = git rev-parse {target_branch}` and log a warning.

**Unexpected commit detection**: Compare `git rev-parse HEAD` against the expected HEAD after the last TddEngineer run. If HEAD has advanced by commits not made by the auto-fix agent, warn: "Detected {N} commits not from the auto-fix agent. These will be included in the incremental review."

### 2B.2 Incremental Diff and Review

```bash
git diff {last_review_commit}...HEAD
```

If empty (no changes since last review), the prior fixes were clean → proceed to Phase 2C.

Otherwise:

```
/deep_review --base={last_review_commit} --head=HEAD
```

**On `/deep_review` failure**: If the plugin errors or times out mid-loop, retry once. If it fails again, present the error to the user with options: **retry**, **skip to approval gate** (proceed to Phase 3 with a warning that final validation was not completed), or **abort**.

### 2B.3 Parse and Check Convergence

Parse findings (same schema as 2A.2). Write consolidated review to `review_iteration_file`.

**Converged** = 0 Critical + 0 Major + 0 Minor in the incremental diff. Suggestions do not block convergence.

If converged → proceed to Phase 2C.

### 2B.4 Handle Findings

Same severity handling as 2A.3:
- **Critical**: STOP, present to user, get direction.
- **Major + Minor**: auto-fix via TddEngineer.

### 2B.5 Apply Fixes and Update Snapshot

Same as 2A.4 (including failure handling). After fixes: `last_review_commit = git rev-parse HEAD`. Increment `stages.review.iterations`.

### 2B.6 Iteration Cap

If total iterations = 5 and not converged → hard stop. Set `stages.review.phase = "capped"`. Proceed to approval gate (Phase 3) with warning that convergence was not reached.

---

## Phase 2C: Final Validation Review

One last full-branch review to catch interaction bugs missed by incremental reviews.

### 2C.1 Full Diff Review

```bash
git diff {target_branch}...{feature_branch}
```

```
/deep_review --base={target_branch} --head={feature_branch}
```

### 2C.2 Assess Final State

Parse findings. Compare against the Phase 2A initial findings to identify:
- **Resolved**: findings from 2A no longer present (matched by file + similar summary).
- **New**: findings not seen in 2A — these are regressions introduced by fix commits.
- **Persistent**: findings still present from 2A.

Set `stages.review.phase = "validation"`.

### 2C.3 Handle Validation Results

If 0 Critical + 0 Major → **CLEAN**. Proceed to Phase 3 (approval gate).

If Critical or Major remain:
- Present findings with context (new vs persistent vs resolved).
- Do NOT re-enter the auto-fix loop. Present to user at the approval gate with a warning.

---

## Phase 3: Approval Gate

Present review summary:
- Total iterations completed
- Phase reached (converged / capped / validation findings)
- Findings: resolved count, auto-fixed count, remaining count, dismissed (with rationale)
- Follow-up items (suggestions)
- Test status (from TddEngineer's last run)

Warn if Critical or Major findings remain unresolved.

User chooses:
- **Approve** → write final summary to `review_summary_file` path from state, proceed to Stage 5
- **Iterate** → spawn TDD engineer with full context (see below), then return to Phase 2B
- **Abort** → stop pipeline

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
    Full review: {review_iteration_file from state}

  User direction:
    {verbatim user instruction}

  Read review and impl summary to understand what needs to change.
  Use TDD. Keep all existing tests passing.
  Commit: "review: fix {severity} — {description}"
  Run full suite when done.
  Write updated summary to: {impl_summary_file from state}
```

After TddEngineer completes, update `last_review_commit` and return to Phase 2B.

---

## Phase 4: Update State

Deep-merge into state:

- **Approve** → `stages.review.completed = true`, `stages.review.approved = true`, `stages.review.phase = "complete"`, populate findings counts (including `auto_fixed` and `dismissed`)
- **Abort** → `stages.review.approved = false`, `status = "aborted"`
