# Auto-Converging Review Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fixed 3-iteration review loop in Stage 4 with a three-phase auto-converging loop (Full Review → Incremental Fix Loop → Final Validation) that auto-fixes Minor+Major findings and only pauses for Critical findings or final user approval.

**Architecture:** The `code_review` skill gets a new three-phase structure: Phase A does a full branch diff review, Phase B iteratively re-reviews only fix changes (up to 5 total iterations), and Phase C runs one final full-branch review as a safety net. The user always approves before PR creation.

**Tech Stack:** Markdown skill files, JSON state schema — no runtime code.

**Design doc:** `docs/plans/2026-03-05-auto-converging-review-loop-design.md`

---

### Task 1: Rewrite `code_review` SKILL.md — Phase 1 (Validate)

**Files:**
- Modify: `plugins/full-orchestration/skills/code_review/SKILL.md:1-30`

**Step 1: Update the frontmatter description**

Replace lines 2-8 with:

```yaml
name: code_review
description: >-
  Run adversarial code review with auto-converging fix loop. Use when you
  have a completed implementation branch ready for review before PR
  creation. Delegates to deep-review for three-agent analysis, auto-fixes
  Minor and Major findings, pauses only on Critical, and runs a final
  validation review before gating user approval.
```

**Step 2: Update the intro and Phase 1**

Replace lines 11-30 (from `# Code Review` through end of Phase 1) with:

```markdown
# Code Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Three-phase auto-converging review: full review → incremental fix loop → final validation → user approval.

## Usage

` ` `
/code_review <ticket-id>
` ` `

---

## Phase 1: Validate

Read state. Confirm `stages.implement.completed` is true. Extract `feature_branch` and `target_branch`. Verify feature branch exists.

Report: ticket ID, branches, strategy (three-phase: initial → incremental (max 5) → validation).

If `/deep_review` is unavailable: stop and show `/plugin install deep-review@ghcp-dev-plugin`.

Record initial snapshot: `last_review_commit = git rev-parse {target_branch}` (the base before any review fixes).
```

**Step 3: Verify**

Read the file and confirm Phase 1 is coherent and the frontmatter YAML is valid.

**Step 4: Commit**

```bash
git add plugins/full-orchestration/skills/code_review/SKILL.md
git commit -m "refactor(code_review): update Phase 1 for three-phase review loop"
```

---

### Task 2: Rewrite `code_review` SKILL.md — Phase 2 (Three-Phase Loop)

**Files:**
- Modify: `plugins/full-orchestration/skills/code_review/SKILL.md` (replace old Phase 2 section, lines 32-91)

**Step 1: Replace old Phase 2 with Phase 2A (Initial Full Review)**

Remove everything from `## Phase 2: Review Iteration Loop` through `### 2.5 Iterate or Continue` and replace with:

```markdown
---

## Phase 2A: Initial Full Review

### 2A.1 Full Diff and Review

` ` `bash
git diff {target_branch}...{feature_branch}
` ` `

If empty, skip to approval gate. Otherwise:

` ` `
/deep_review --base={target_branch} --head={feature_branch}
` ` `

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

### 2A.3 Handle by Severity

- **Critical**: STOP the auto-loop. Present all findings with Critical highlighted at top. User chooses per-Critical: **fix** (with direction), **dismiss** (with rationale), or **abort**. If abort → Phase 5. If fix → spawn TddEngineer (see 2A.4), then re-parse. If dismiss → record in state `findings.dismissed` array with `{id, severity, summary, rationale}`, continue.
- **Major**: auto-fix via TddEngineer (2A.4). No user input needed.
- **Minor**: auto-fix via TddEngineer (2A.4). If fix fails, demote to suggestion.
- **Suggestion**: collect for follow-up.

### 2A.4 Apply Fixes

Collect all Major + Minor findings (and any user-directed Critical fixes). Spawn TDD engineer:

` ` `
subagent_type: full-orchestration:TddEngineer
prompt: |
  Applying review fixes on {feature_branch}.
  Findings to fix:
  {list with file:line references and severity}

  For each: write/update test, apply fix, run tests, commit.
  Commit message: "review: fix {severity} — {description}"
  Do NOT modify beyond scope of these fixes.
` ` `

### 2A.5 Record Snapshot

After fixes are committed: `last_review_commit = git rev-parse HEAD`. Update state. Set `stages.review.phase = "incremental"`. Increment `stages.review.iterations`. Proceed to Phase 2B.

If no actionable findings (only suggestions) → skip to Phase 2C.
```

**Step 2: Verify**

Read the file and confirm Phase 2A reads coherently.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/skills/code_review/SKILL.md
git commit -m "refactor(code_review): add Phase 2A initial full review"
```

---

### Task 3: Rewrite `code_review` SKILL.md — Phase 2B (Incremental Fix Loop)

**Files:**
- Modify: `plugins/full-orchestration/skills/code_review/SKILL.md` (append after Phase 2A)

**Step 1: Add Phase 2B section**

Insert after Phase 2A:

```markdown
---

## Phase 2B: Incremental Fix Loop

Repeat until converged or iteration cap (5 total iterations including Phase 2A):

### 2B.1 Incremental Diff and Review

` ` `bash
git diff {last_review_commit}...HEAD
` ` `

If empty (no changes since last review), the prior fixes were clean → proceed to Phase 2C.

Otherwise:

` ` `
/deep_review --base={last_review_commit} --head=HEAD
` ` `

### 2B.2 Parse and Check Convergence

Parse findings (same schema as 2A.2).

**Converged** = 0 Critical + 0 Major + 0 Minor in the incremental diff. Suggestions do not block convergence.

If converged → proceed to Phase 2C.

### 2B.3 Handle Findings

Same severity handling as 2A.3:
- **Critical**: STOP, present to user, get direction.
- **Major + Minor**: auto-fix via TddEngineer.

### 2B.4 Apply Fixes and Update Snapshot

Same as 2A.4. After fixes: `last_review_commit = git rev-parse HEAD`. Increment `stages.review.iterations`.

### 2B.5 Iteration Cap

If total iterations = 5 and not converged → hard stop. Set `stages.review.phase = "capped"`. Proceed to approval gate (Phase 3) with warning that convergence was not reached.
```

**Step 2: Verify**

Read the file and confirm Phase 2B follows logically from 2A.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/skills/code_review/SKILL.md
git commit -m "refactor(code_review): add Phase 2B incremental fix loop"
```

---

### Task 4: Rewrite `code_review` SKILL.md — Phase 2C (Final Validation)

**Files:**
- Modify: `plugins/full-orchestration/skills/code_review/SKILL.md` (append after Phase 2B)

**Step 1: Add Phase 2C section**

Insert after Phase 2B:

```markdown
---

## Phase 2C: Final Validation Review

One last full-branch review to catch interaction bugs missed by incremental reviews.

### 2C.1 Full Diff Review

` ` `bash
git diff {target_branch}...{feature_branch}
` ` `

` ` `
/deep_review --base={target_branch} --head={feature_branch}
` ` `

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
```

**Step 2: Verify**

Read the file and confirm Phase 2C is coherent.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/skills/code_review/SKILL.md
git commit -m "refactor(code_review): add Phase 2C final validation review"
```

---

### Task 5: Rewrite `code_review` SKILL.md — Phase 3 (Approval Gate) and Phase 4 (State)

**Files:**
- Modify: `plugins/full-orchestration/skills/code_review/SKILL.md` (replace old Phase 3 and Phase 4)

**Step 1: Replace approval gate section**

Remove old Phase 3 and Phase 4 (everything from `## Phase 3: Approval Gate` to end of file). Replace with:

```markdown
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

` ` `
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
` ` `

After TddEngineer completes, update `last_review_commit` and return to Phase 2B.

---

## Phase 4: Update State

Deep-merge into state:

- **Approve** → `stages.review.completed = true`, `stages.review.approved = true`, `stages.review.phase = "complete"`, populate findings counts (including `auto_fixed` and `dismissed`)
- **Abort** → `stages.review.approved = false`, `status = "aborted"`
```

**Step 2: Verify**

Read the complete file end-to-end. Confirm all phases flow: 1 → 2A → 2B → 2C → 3 → 4.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/skills/code_review/SKILL.md
git commit -m "refactor(code_review): add approval gate and state update for converging loop"
```

---

### Task 6: Update `04-code-review.md` — Iteration Loop Diagram

**Files:**
- Modify: `plugins/full-orchestration/docs/04-code-review.md:39-106`

**Step 1: Replace the iteration loop diagram and steps**

Remove the old diagram (lines 41-93) and iteration steps (lines 95-105). Replace with:

```markdown
## Review Loop: Three-Phase Architecture

` ` `
┌──────────────────────────────────────┐
│  Phase A: Initial Full Review         │
│  git diff {target}...{feature}       │
│  /deep_review (full branch diff)     │
└──────────────┬───────────────────────┘
               │
        ┌──────┴──────┐
        │             │
   No findings    Findings
        │             │
        │      ┌──────┴──────────┐
        │      │ Critical?       │
        │      │ YES → ask user  │
        │      │ NO  → auto-fix  │
        │      └──────┬──────────┘
        │             │
        │      ┌──────┴──────────┐
        │      │ TddEngineer     │
        │      │ applies fixes   │
        │      │ records snapshot│
        │      └──────┬──────────┘
        │             │
        ▼             ▼
┌──────────────────────────────────────┐
│  Phase B: Incremental Fix Loop       │◄────────────┐
│  git diff {snapshot}...HEAD          │             │
│  /deep_review (fix changes only)     │             │
└──────────────┬───────────────────────┘             │
               │                                     │
        ┌──────┴──────┐                              │
        │             │                              │
   Converged     Findings                            │
   (0 C/M/Mi)        │                              │
        │      ┌──────┴──────────┐                   │
        │      │ Critical → user │                   │
        │      │ Major → auto-fix│                   │
        │      │ Minor → auto-fix│                   │
        │      └──────┬──────────┘                   │
        │             │                              │
        │      TddEngineer fixes                     │
        │             │                              │
        │      iteration < 5? ─── Yes ───────────────┘
        │             │
        │          No (capped)
        │             │
        ▼             ▼
┌──────────────────────────────────────┐
│  Phase C: Final Validation Review     │
│  git diff {target}...{feature}       │
│  /deep_review (full branch diff)     │
│  Compare vs Phase A findings          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Approval Gate (always)               │
│  User: approve / iterate / abort     │
└──────────────────────────────────────┘
` ` `

### Phase details

1. **Phase A — Initial full review**: The orchestrator runs `/deep_review` against the complete branch diff. Critical findings pause for user input. Major and Minor findings are auto-fixed by the TDD engineer. A git snapshot is recorded after fixes.
2. **Phase B — Incremental fix loop**: Subsequent iterations review only the diff since the last snapshot (fix changes only). The loop converges when a re-review returns 0 Critical + 0 Major + 0 Minor findings. Max 5 total iterations (including Phase A). If capped without convergence, proceeds to Phase C with a warning.
3. **Phase C — Final validation**: One last full-branch review catches interaction bugs that incremental reviews missed. Findings are compared to Phase A to identify regressions vs persistent issues. Does not re-enter the auto-fix loop — any remaining Critical/Major are presented at the approval gate.
4. **Approval gate**: Always reached. User sees iteration count, findings breakdown (resolved, auto-fixed, dismissed, remaining), and test status. User chooses approve, iterate (back to Phase B with direction), or abort.
```

**Step 2: Verify**

Read the file and confirm the new diagram renders correctly in markdown.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/docs/04-code-review.md
git commit -m "docs(code-review): update iteration loop diagram for three-phase architecture"
```

---

### Task 7: Update `04-code-review.md` — Severity Table

**Files:**
- Modify: `plugins/full-orchestration/docs/04-code-review.md:109-125`

**Step 1: Update the "How severities drive the loop" section**

Replace lines 120-125 with:

```markdown
### How severities drive the loop

- **Critical** findings break the auto-loop. The orchestrator pauses immediately and presents Critical findings for user decision: fix (with direction), dismiss (with rationale), or abort. Dismissed Criticals are recorded in state.
- **Major** findings are auto-fixed by the TDD engineer. No user input required — the re-review in subsequent iterations validates the fix.
- **Minor** findings are auto-fixed. If auto-fix fails, they are demoted to suggestions.
- **Suggestions** are collected into a "Follow-up Items" section and do not block convergence.
```

**Step 2: Verify**

Read the file. Confirm the severity table at lines 111-118 is still accurate (it is — the *meanings* haven't changed, only the *actions*).

**Step 3: Commit**

```bash
git add plugins/full-orchestration/docs/04-code-review.md
git commit -m "docs(code-review): update severity actions for auto-fix Major"
```

---

### Task 8: Update `04-code-review.md` — Approval Gate Section

**Files:**
- Modify: `plugins/full-orchestration/docs/04-code-review.md:145-153`

**Step 1: Update the approval gate section**

Replace lines 145-153 with:

```markdown
## Approval Gate

After the three-phase review completes, the orchestrator **always** presents a summary and waits for explicit user approval before proceeding to [Stage 5: PR Creation](05-pr-creation.md).

The approval prompt includes:
- Iterations completed and phase reached (converged / capped / validation findings)
- Findings breakdown: resolved, auto-fixed, remaining, dismissed (with rationale)
- Follow-up items (suggestions collected across all phases)
- Confirmation that all tests still pass after review fixes

User chooses:
- **Approve** — proceed to Stage 5
- **Iterate** — spawn TDD engineer with full context + user direction, return to Phase B
- **Abort** — stop pipeline
```

**Step 2: Verify**

Read the file. Confirm the updated approval gate section is coherent.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/docs/04-code-review.md
git commit -m "docs(code-review): update approval gate for three-phase loop"
```

---

### Task 9: Update `10-data-models-and-context.md` — Review State Schema

**Files:**
- Modify: `plugins/full-orchestration/docs/10-data-models-and-context.md:45-57`

**Step 1: Update the review section of the state schema**

Replace lines 45-57 (the `"review"` block inside the Full Schema) with:

```json
    "review": {
      "completed": false,
      "approved": false,
      "last_review_commit": null,
      "iterations": 0,
      "phase": "initial | incremental | validation | capped | complete",
      "review_iteration_file": ".claude/swe-state/PROJ-123/review-iteration.md",
      "review_summary_file": ".claude/swe-state/PROJ-123/review-summary.md",
      "findings": {
        "critical": { "total": 0, "fixed": 0, "dismissed": 0 },
        "major": { "total": 0, "fixed": 0, "auto_fixed": 0, "deferred": 0, "dismissed": 0 },
        "minor": { "total": 0, "fixed": 0, "auto_fixed": 0 },
        "suggestions": 0,
        "dismissed": []
      }
    },
```

**Step 2: Verify**

Read the file. Confirm the JSON is valid and the new fields (`last_review_commit`, `phase`, `auto_fixed`, `dismissed` array) are present.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/docs/10-data-models-and-context.md
git commit -m "docs(data-models): add review state fields for converging loop"
```

---

### Task 10: Update `10-data-models-and-context.md` — Review Iteration Context

**Files:**
- Modify: `plugins/full-orchestration/docs/10-data-models-and-context.md:620-683`

**Step 1: Update the "Iterate Loop Context Passing" section**

Replace lines 653-683 (from `### Iterate Loop Context Passing` to end of Stage 4 section) with:

```markdown
### Auto-Fix Context Passing

In Phases 2A and 2B, when Major or Minor findings need auto-fixing, `code_review` spawns TddEngineer with a scoped prompt:

` ` `
subagent_type: full-orchestration:TddEngineer
prompt: |
  Applying review fixes on {feature_branch}.
  Findings to fix:
  {list with file:line references and severity}

  For each: write/update test, apply fix, run tests, commit.
  Commit message: "review: fix {severity} — {description}"
  Do NOT modify beyond scope of these fixes.
` ` `

### User-Directed Iterate Context Passing

When the user chooses "Iterate" at the approval gate, `code_review` spawns TddEngineer with full context AND user direction:

` ` `
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
` ` `

After completion, `code_review` updates `last_review_commit` and returns to Phase 2B.

### Review Phase Tracking

The `stages.review.phase` field tracks progression:

| Phase Value | Meaning |
|---|---|
| `initial` | Phase 2A in progress |
| `incremental` | Phase 2B in progress |
| `validation` | Phase 2C in progress |
| `capped` | Hit iteration cap without convergence |
| `complete` | User approved at gate |
```

**Step 2: Verify**

Read the file end-to-end for the Stage 4 section. Confirm context passing docs are complete.

**Step 3: Commit**

```bash
git add plugins/full-orchestration/docs/10-data-models-and-context.md
git commit -m "docs(data-models): update context passing for auto-fix and iterate loops"
```

---

### Task 11: Final Verification

**Files:**
- Read: `plugins/full-orchestration/skills/code_review/SKILL.md` (full)
- Read: `plugins/full-orchestration/docs/04-code-review.md` (full)
- Read: `plugins/full-orchestration/docs/10-data-models-and-context.md` (Stage 4 section)

**Step 1: Cross-reference consistency**

Verify:
1. SKILL.md phases (1, 2A, 2B, 2C, 3, 4) match the doc diagram
2. State field names in SKILL.md match the schema in `10-data-models`
3. Severity actions are consistent across SKILL.md and `04-code-review.md`
4. TddEngineer spawn prompts are identical in SKILL.md and `10-data-models`
5. The `paths` object in the state schema includes `review_iteration_file` and `review_summary_file`
6. The approval gate options are consistent across all three files

**Step 2: Fix any inconsistencies found**

If any mismatches, fix in the appropriate file and commit.

**Step 3: Final commit (if needed)**

```bash
git add -A
git commit -m "fix(code-review): resolve cross-file inconsistencies in review loop docs"
```
