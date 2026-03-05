---
name: tdd_implement
description: "Implement a ticket using test-driven development. Use when you have an approved spec and implementation plan and are ready to write code. Spawns a TDD engineer agent in an isolated worktree."
---

# TDD Implement

Orchestrate Stage 3 of the software engineering pipeline: spawn the TDD engineer agent to implement the approved spec and implementation plan using strict red/green/refactor methodology in an isolated git worktree.

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
4. Report to the user:

```
TDD Implementation: {ticket-id}
  Steps: {step-count}
  Language: {language}
  Strategy: Red/Green/Refactor in isolated worktree

Spawning TDD engineer...
```

---

## Phase 2: Spawn TDD Engineer

Spawn the TDD engineer agent in an isolated worktree:

```
subagent_type: full-orchestration:TddEngineer
isolation: "worktree"
prompt: |
  You are the TDD ENGINEER.
  Read your instructions: plugins/full-orchestration/agents/tdd-engineer.agent.md

  Your inputs:
    Technical spec:       .claude/specs/{ticket-id}.md
    Implementation plan:  .claude/specs/{ticket-id}-impl.md
    Codebase context:     .claude/specs/{ticket-id}-context.md

  Execute the implementation plan using strict TDD (red/green/refactor).
  Create feature branch: feat/{ticket-id}-{short-description}
  Commit after each passing step.
  Run the full test suite when all steps are complete.

  Write the implementation summary to: .claude/swe-state/{ticket-id}/impl-summary.md
```

Wait for the agent to complete.

---

## Phase 3: Report Results

1. Read `.claude/swe-state/{ticket-id}/impl-summary.md`
2. Report to the user:

```
TDD Implementation Complete: {ticket-id}

Branch: feat/{ticket-id}-{short-description}
Tests:  {new-count} new, {modified-count} modified — {PASS/FAIL}
Coverage: {X%} (if available)

Deviations from plan:
  {deviations or "None"}

The implementation is ready for code review.
```

---

## Phase 4: Update Pipeline State

Update `.claude/swe-state/{ticket-id}.json` with Stage 3 results:

```json
{
  "current_stage": "implement",
  "status": "awaiting_approval",
  "stages": {
    "implement": {
      "completed": true,
      "worktree": ".claude/worktrees/{ticket-id}",
      "branch": "feat/{ticket-id}-{short-description}",
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
| No summary produced | Check if the worktree has commits; report partial progress and suggest retry |
| WIP commits present | Warn the user that some steps were blocked; list affected steps from the summary |
| All steps blocked | Report that implementation could not proceed; suggest reviewing the implementation plan |

---

## Artifacts Produced

| File | Contents |
|---|---|
| `.claude/swe-state/{ticket-id}/impl-summary.md` | Implementation summary with branch, changes, test results, deviations |
| Feature branch `feat/{ticket-id}-{short-description}` | All committed code changes from the TDD cycle |

---

## Handoff to Stage 4

After the user reviews and approves the implementation:

```
Next step: /code_review {ticket-id}

Or continue the full pipeline: /swe {ticket-id} --from=review
```
