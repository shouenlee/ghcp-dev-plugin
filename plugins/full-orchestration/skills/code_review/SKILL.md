---
name: code_review
description: "Run adversarial code review on a TDD implementation. Use when you have a completed implementation branch ready for review before PR creation. Delegates to the deep-review plugin for parallel three-agent analysis, classifies findings by severity, auto-fixes minor issues, and gates approval."
---

# Code Review

Orchestrate Stage 4 of the software engineering pipeline: subject the implementation from Stage 3 to adversarial, multi-perspective code review using the `deep-review` plugin, then drive an iteration loop of severity classification, auto-fixing, and user approval.

## Usage

```
/code_review <ticket-id>
```

---

## Prerequisites

Validate that these files exist before proceeding:

1. **Implementation Summary**: `.claude/swe-state/{ticket-id}/impl-summary.md`
2. **Pipeline State**: `.claude/swe-state/{ticket-id}.json`

Read `.claude/swe-state/{ticket-id}.json` and confirm `stages.implement.completed` is `true`.

If any prerequisite is missing or Stage 3 is incomplete, stop and tell the user:

```
Missing prerequisites for code review.

Required:
  - .claude/swe-state/{ticket-id}/impl-summary.md   (implementation summary)
  - .claude/swe-state/{ticket-id}.json               (pipeline state with stages.implement.completed = true)

Run /tdd_implement {ticket-id} to complete implementation first.
```

---

## Phase 1: Validate Inputs

1. Read `.claude/swe-state/{ticket-id}.json`
2. Extract the **feature branch name** from `feature_branch` in the state file (top-level field)
3. Extract the **target branch** from `target_branch` in the state file (default: `main` if not set)
4. Verify the feature branch exists: `git branch --list <branch>`
5. Report to the user:

```
Code Review: {ticket-id}
  Branch: {feature-branch}
  Target: {target-branch}
  Strategy: Adversarial 3-agent review via deep-review (max 3 iterations)

Starting review...
```

---

## Phase 2: Review Iteration Loop

Repeat up to **3 iterations**. Each iteration:

### 2.1 Generate Diff

```bash
git diff {target-branch}...{feature-branch}
```

If the diff is empty, skip review and proceed directly to the approval gate.

### 2.2 Invoke Deep Review

Invoke `/deep_review` with branch arguments so it diffs the feature branch against the target:

```
/deep_review --base={target-branch} --head={feature-branch}
```

The deep-review plugin will generate the diff via `git diff {base}...{head}`, spawn three parallel agents (Advocate, Skeptic, Architect), and produce a consolidated review with a structured findings block.

If `/deep_review` is not available (plugin not installed), stop and tell the user:

```
The deep-review plugin is required for code review but is not installed.

Install it with:
  /plugin install deep-review@ghcp-dev-plugin

Then re-run: /code_review {ticket-id}
```

### 2.3 Map Findings to Severity

Parse the `<!-- structured-findings ... -->` block from the deep-review output. Each finding has fields defined by the schema contract below.

#### Schema Contract

This schema is a contract between `deep_review` (producer) and `code_review` (consumer). Changes must be synchronized across both plugins.

| Field | Type | Allowed Values |
|---|---|---|
| `id` | integer | Sequential from 1 |
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `file` | string | Relative path from repo root |
| `line` | integer or null | Line number, or null if not applicable |
| `summary` | string | One-line description of the finding |
| `agents` | list of strings | `advocate`, `skeptic`, `architect` |

Map `deep-review` priority levels to the pipeline severity system:

| deep-review Priority | Pipeline Severity | Action |
|---|---|---|
| **Critical** | **Critical** | Blocks merge — must fix before approval |
| **High** | **Major** | User decides: fix, defer, or dismiss |
| **Medium** | **Minor** | Auto-fix when possible |
| **Low** | **Suggestion** | Collect for follow-up items |

If the structured findings block is missing (e.g., older deep-review version), fall back to extracting priorities from the markdown `**Priority**: ...` lines in the Consolidated Findings section.

### 2.4 Present Findings

Show the user the consolidated review with severity classifications:

```
Review Iteration {N} — {ticket-id}

Critical ({count}):
  - {finding} — {file}:{line}

Major ({count}):
  - {finding} — {file}:{line}

Minor ({count}):
  - {finding} — {file}:{line}

Suggestions ({count}):
  - {finding}
```

### 2.5 Handle by Severity

- **Critical**: Present each finding. The user must choose for each: `fix` or `dismiss with rationale`. Critical findings block approval unless dismissed.
- **Major**: Present each finding. The user chooses: `fix`, `defer` (creates follow-up item), or `dismiss with rationale`.
- **Minor**: Auto-fix without user intervention. If auto-fix fails for a finding, present it as a suggestion instead.
- **Suggestion**: Collect into a "Follow-up Items" section. No action required this iteration.

### 2.6 Apply Fixes via TDD Engineer

If there are findings to fix (accepted Critical, Major, or Minor auto-fixes), spawn the TDD engineer:

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  You are the TDD ENGINEER applying review fixes.

  Feature branch: {feature-branch}
  Review findings to fix:
  {list of accepted fixes with file:line references}

  For each fix:
    1. Write or update a test that exposes the issue (if applicable)
    2. Apply the fix
    3. Run tests to confirm they pass
    4. Commit with message: "review: fix {severity} — {short description}"

  Do NOT modify anything beyond the scope of these fixes.
  Write fix results to: .claude/swe-state/{ticket-id}/review-fixes-{N}.md
```

Wait for the agent to complete.

### 2.7 Check Iteration Limit

- If iteration < 3 and fixes were applied, return to step 2.1 for re-review.
- If iteration = 3 and issues remain, proceed to the approval gate with remaining issues noted.
- If no fixes were needed, proceed to the approval gate.

Save each iteration's review to `.claude/swe-state/{ticket-id}/review-iteration-{N}.md`.

---

## Phase 3: Approval Gate

Present the final review summary:

```
Code Review Complete: {ticket-id}

Iterations: {N}
Branch: {feature-branch}

Resolved:
  - {count} Critical, {count} Major, {count} Minor fixed

Remaining:
  - {count} deferred (see follow-up items)
  - {count} dismissed (with rationale)

Follow-up Items:
  - {suggestion or deferred finding}

Tests: {PASS/FAIL} after review fixes
```

If **Critical findings remain unresolved** (not dismissed), warn the user:

```
WARNING: {count} critical finding(s) remain unresolved.
Proceeding is not recommended.
```

Ask the user to choose:
- **Approve** — proceed to Stage 5 (PR creation)
- **Iterate** — spawn the TDD engineer directly with the review findings (see Iterate below). After the engineer completes, return to the review loop (Phase 2) for re-review. This loop is managed entirely within `code_review` — the orchestrator is not involved until `code_review` returns.
- **Abort** — stop the pipeline for this ticket

Write the final summary to `.claude/swe-state/{ticket-id}/review-summary.md`.

---

## Phase 4: Update Pipeline State

Update `.claude/swe-state/{ticket-id}.json` with Stage 4 results. Set `approved` based on the user's choice in Phase 3:

- **Approve** → `"approved": true`, `"status": "approved"`
- **Iterate** → do not update Stage 4 state yet. Spawn the TDD engineer with review findings (see below), then loop back to Phase 2. The orchestrator is not involved — `code_review` manages this loop internally.

### Iterate: Spawn TDD Engineer with Review Findings

Before spawning, capture the user's direction — what they said when they chose "Iterate." This may be a general instruction ("refactor the auth middleware like the architect suggested") or a specific focus ("just fix the critical findings"). Include it verbatim or as a faithful summary.

Spawn the TDD engineer with file references to all relevant context. Do NOT inline findings — the engineer reads them on demand.

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  You are the TDD ENGINEER iterating on a previous implementation
  based on code review feedback.

  Your original inputs:
    Technical spec:       .claude/specs/{ticket-id}.md
    Implementation plan:  .claude/specs/{ticket-id}-impl.md
    Codebase context:     .claude/specs/{ticket-id}-context.md

  Your previous implementation:
    Summary:              .claude/swe-state/{ticket-id}/impl-summary.md

  Review feedback:
    Full review:          .claude/swe-state/{ticket-id}/review-summary.md

  User direction:
    {user's verbatim instruction or faithful summary of what they asked for}

  Read the review summary and your implementation summary to understand
  what was built and what needs to change. Read the spec, plan, and
  context as needed to make correct decisions.

  Use TDD: write or update tests first, then fix. Keep all existing
  tests passing. Work on the current branch — do NOT create or switch
  branches.

  Commit after each fix: "review: fix {severity} — {short description}"
  Run the full test suite when all fixes are complete.

  Write the updated implementation summary to:
    .claude/swe-state/{ticket-id}/impl-summary.md
```

Wait for the agent to complete, then return to Phase 2 for re-review.

- **Abort** → `"approved": false`, `"status": "aborted"`

```json
{
  "current_stage": "review",
  "status": "approved",
  "stages": {
    "review": {
      "completed": true,
      "approved": true,
      "iterations": 0,
      "findings": {
        "critical": { "total": 0, "fixed": 0, "dismissed": 0 },
        "major": { "total": 0, "fixed": 0, "deferred": 0, "dismissed": 0 },
        "minor": { "total": 0, "fixed": 0 },
        "suggestions": 0
      }
    }
  }
}
```

Read the existing state file first and merge — do not overwrite prior stage data.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing prerequisite files | Stop with error message pointing to `/tdd_implement` |
| Stage 3 not completed | Stop with error message; suggest completing implementation first |
| `deep-review` plugin not installed | Stop with install command: `/plugin install deep-review@ghcp-dev-plugin` |
| Deep-review agent failure | Report which agent(s) failed; offer to re-trigger, proceed without, or abort |
| TDD engineer failure during fix | Save partial fix state; report error and suggest retry with `/code_review {ticket-id}` |
| Empty diff | Skip review; proceed directly to approval gate with no findings |
| All iterations exhausted with issues | Present remaining issues; user decides: approve, continue manually, or abort |

---

## Artifacts Produced

| File | Contents |
|---|---|
| `.claude/swe-state/{ticket-id}/review-iteration-{N}.md` | Consolidated review from each iteration with severity classifications |
| `.claude/swe-state/{ticket-id}/review-fixes-{N}.md` | Fixes applied by TDD engineer in each iteration |
| `.claude/swe-state/{ticket-id}/review-summary.md` | Final review summary with all findings, resolutions, and follow-up items |

