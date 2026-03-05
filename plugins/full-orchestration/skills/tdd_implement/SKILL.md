---
name: tdd_implement
description: "Implement a ticket using test-driven development. Use when you have an approved spec and implementation plan and are ready to write code. Spawns a TDD engineer agent on a feature branch."
---

# TDD Implement

Orchestrate Stage 3 of the software engineering pipeline: spawn the TDD engineer agent to implement the approved spec and implementation plan using strict red/green/refactor methodology on a feature branch.

## Usage

```
/tdd_implement <ticket-id>
```

---

## Prerequisites

Validate that these three files exist before proceeding:

1. **Technical Spec**: `.claude/specs/{ticket-id}.md`
2. **Implementation Plan**: `.claude/specs/{ticket-id}-impl.md`
3. **Codebase Context**: `.claude/specs/{ticket-id}-context.md`

Create `.claude/swe-state/{ticket-id}/` if it doesn't exist.

If any prerequisite file is missing, stop and tell the user:

```
Missing prerequisite files for TDD implementation.

Required:
  - .claude/specs/{ticket-id}.md        (technical spec)
  - .claude/specs/{ticket-id}-impl.md   (implementation plan)
  - .claude/specs/{ticket-id}-context.md (codebase context)

Run /spec_writer {ticket-id} to generate these files first.
```

---

## Phase 1: Validate Inputs

1. Read `.claude/specs/{ticket-id}-impl.md`
2. Extract the step count from Section 6 (Implementation Order)
3. Detect the primary language from the implementation plan
4. Read `.claude/swe-state/{ticket-id}.json` and extract `feature_branch` (top-level field)
5. Confirm the current branch matches `feature_branch`: `git branch --show-current`. If they differ, warn the user and offer to switch.
6. Report to the user:

```
TDD Implementation: {ticket-id}
  Steps: {step-count}
  Language: {language}
  Branch: {current-branch}
  Strategy: Red/Green/Refactor

Spawning TDD engineer...
```

---

## Phase 2: Spawn TDD Engineer

Spawn the TDD engineer agent. The agent works on the current branch — it does not create or switch branches.

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  You are the TDD ENGINEER.

  Your inputs:
    Technical spec:       .claude/specs/{ticket-id}.md
    Implementation plan:  .claude/specs/{ticket-id}-impl.md
    Codebase context:     .claude/specs/{ticket-id}-context.md

  Execute the implementation plan using strict TDD (red/green/refactor).
  Work on the current branch. Do NOT create or switch branches.
  Commit after each passing step.
  Run the full test suite when all steps are complete.

  Write the implementation summary to: .claude/swe-state/{ticket-id}/impl-summary.md
```

Wait for the agent to complete.

---

## Phase 3: Report Results

1. Read `.claude/swe-state/{ticket-id}/impl-summary.md`
2. Extract the overall test suite result (`PASS` or `FAIL`) from the summary.
3. Report to the user:

```
TDD Implementation Complete: {ticket-id}

Branch: {current-branch}
Tests:  {new-count} new, {modified-count} modified — {PASS/FAIL}
Coverage: {X%} (if available)

Deviations from plan:
  {deviations or "None"}
```

### On PASS

Proceed to Phase 4.

### On FAIL

Do **not** proceed to Phase 4. Do **not** mark the stage as completed. Report the failure:

```
Stage 3 (TDD Implementation) failed: tests did not pass after implementation.

{test failure details from impl-summary}

Pipeline state saved. Resume with:
  /swe {ticket-id} --from=implement
```

Return the error to the orchestrator so it can save state with `status: "failed"`.

---

## Phase 4: Update Pipeline State

Update `.claude/swe-state/{ticket-id}.json` with Stage 3 results:

```json
{
  "current_stage": "implement",
  "feature_branch": "{current-branch}",
  "stages": {
    "implement": {
      "completed": true,
      "test_results": {
        "new_tests": 0,
        "modified_tests": 0,
        "total_suite": "PASS",
        "coverage": null
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
| Missing prerequisite files | Stop with error message pointing to `/spec_writer` |
| Agent failure (crash/timeout) | Report the error, save partial state, suggest `/swe {ticket-id} --from=implement` to retry |
| No summary produced | Check if the branch has commits; report partial progress and suggest retry |
| WIP commits present | Warn the user that some steps were blocked; list affected steps from the summary |
| All steps blocked | Report that implementation could not proceed; suggest reviewing the implementation plan |

---

## Artifacts Produced

| File | Contents |
|---|---|
| `.claude/swe-state/{ticket-id}/impl-summary.md` | Implementation summary with branch, changes, test results, deviations |
| Current branch (recorded in state) | All committed code changes from the TDD cycle |

