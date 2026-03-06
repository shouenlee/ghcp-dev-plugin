---
name: tdd_implement
description: >-
  Implement a ticket using test-driven development. Use when you have
  an approved spec and implementation plan and are ready to write
  code. Spawns a TDD engineer agent on the feature branch specified
  in the state file.
---

# TDD Implement

**State file**: `.claude/swe-state/{ticket-id}.json`

Spawn the TDD engineer to execute the approved implementation plan using red/green/refactor.

## Usage

```
/tdd_implement <ticket-id>
```

---

## Phase 1: Validate

1. Read state. Confirm `stages.spec.completed` is true.
2. Verify these files exist (paths from state): spec, impl plan, context doc.
3. Extract `feature_branch` from state. Confirm current branch matches — warn and offer to switch if not.
4. Extract step count and language from the impl plan.
5. Report: ticket ID, step count, language, branch, strategy.

---

## Phase 2: Spawn TDD Engineer

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  Your inputs:
    Technical spec:       {spec_file from state}
    Implementation plan:  {impl_plan_file from state}
    Codebase context:     {context_file from state}

  Execute the implementation plan using strict TDD (red/green/refactor).
  Work on the current branch. Do NOT create or switch branches.
  Commit after each passing step.
  Run the full test suite when all steps are complete.

  Write the implementation summary to: {impl_summary_file from state}
```

---

## Phase 3: Report Results

Read the impl summary. Extract test result (PASS/FAIL).

**On PASS**: update state — `stages.implement.completed = true`, populate `test_results`.

**On FAIL**: do NOT mark completed. Report failure details and suggest `/swe {ticket-id} --from=implement`.
