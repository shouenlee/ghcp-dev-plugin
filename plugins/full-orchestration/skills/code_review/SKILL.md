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

1. Read `.claude/swe-state/{ticket-id}/impl-summary.md`
2. Extract the **feature branch name** from the summary
3. Extract the **target branch** from `.claude/swe-state/{ticket-id}.json` (default: `main`)
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

Ensure the feature branch is checked out, then invoke `/deep_review` with no arguments. The deep-review plugin will detect the current branch, gather the diff against the target branch on its own, spawn three parallel agents (Advocate, Skeptic, Architect), and produce a consolidated review.

Do NOT pass a pre-generated diff — let deep-review handle context gathering internally.

### 2.3 Map Findings to Severity

Map `deep-review` priority levels to the pipeline severity system:

| deep-review Priority | Pipeline Severity | Action |
|---|---|---|
| **Critical** | **Critical** | Blocks merge — must fix before approval |
| **High** | **Major** | User decides: fix, defer, or dismiss |
| **Medium** | **Minor** | Auto-fix when possible |
| **Low** | **Suggestion** | Collect for follow-up items |

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
  Read your instructions: plugins/full-orchestration/agents/tdd-engineer.agent.md

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
- **Continue manually** — exit the skill; user handles remaining issues
- **Abort** — stop the pipeline for this ticket

Write the final summary to `.claude/swe-state/{ticket-id}/review-summary.md`.

---

## Phase 4: Update Pipeline State

Update `.claude/swe-state/{ticket-id}.json` with Stage 4 results:

```json
{
  "current_stage": "review",
  "status": "awaiting_approval",
  "stages": {
    "review": {
      "completed": true,
      "iterations": 0,
      "branch": "feat/{ticket-id}-{short-description}",
      "findings": {
        "critical": { "total": 0, "fixed": 0, "dismissed": 0 },
        "major": { "total": 0, "fixed": 0, "deferred": 0, "dismissed": 0 },
        "minor": { "total": 0, "fixed": 0 },
        "suggestions": 0
      },
      "approved": false
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

---

## Handoff to Stage 5

After the user approves the review:

```
Next step: /pr_create {ticket-id}

Or continue the full pipeline: /swe {ticket-id} --from=pr
```
