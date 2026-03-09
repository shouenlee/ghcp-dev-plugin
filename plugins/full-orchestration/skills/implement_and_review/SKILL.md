---
name: implement_and_review
description: >-
  Implement a ticket using TDD and review in a converging loop. Use
  when you have an approved spec and implementation plan. Spawns
  TddEngineer for implementation, delegates to deep-review for
  adversarial analysis, and auto-fixes findings in an autonomous
  loop (max 5 rounds) before gating user approval.
---

# Implement & Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Unified stage: TDD implementation followed by a review-fix loop that converges before user approval. Same author→reviewer→fix loop structure as 2B↔2C, but with severity-based convergence (0 Critical + 0 Major + 0 Minor) instead of comment-based (0 OPEN).

## Usage

```
/implement_and_review <ticket-id>
```

---

## Phase 1: Validate

1. Read state. Confirm `stages.spec.completed` is true.
2. Verify these files exist (paths from state): spec, impl plan, context doc.
3. Extract `feature_branch` and `target_branch` from state. Confirm current branch matches feature branch — warn and offer to switch if not.
4. Extract step count and language from the impl plan.
5. If `/deep_review` is unavailable: stop and show `/plugin install deep-review@ghcp-dev-plugin`.
6. Report: ticket ID, step count, language, branches, strategy (TDD then review-fix loop, max 5 rounds).

---

## Phase 2: Initial Implementation

Spawn TDD engineer to execute the approved implementation plan:

```
subagent_type: full-orchestration:TddEngineer
max_turns: 30
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Read state to locate:
  - stages.spec.spec_file (technical spec)
  - stages.spec.impl_plan_file (implementation plan)
  - stages.spec.context_file (codebase context)
  - stages.implement.impl_summary_file (write summary here when done)

  Execute the implementation plan using strict TDD (red/green/refactor).
  Work on the current branch. Do NOT create or switch branches.
  Commit after each passing step.
  Run the full test suite when all steps are complete.
  Write the implementation summary to the impl_summary_file path from state.
```

Read the impl summary. Extract test result (PASS/FAIL).

**On PASS**: update state — `stages.implement.completed = true`, populate `test_results`. Set `stages.review.phase = "reviewing"`. Proceed to Phase 3.

**On FAIL**: do NOT mark completed. Report failure details to the user. User chooses:
- **Retry** (with direction) → capture user direction, respawn TddEngineer with the same prompt plus user direction appended. Repeat until PASS or user aborts.
- **Continue to review** → mark `stages.implement.completed = true` with a note in test_results that suite did not fully pass. Proceed to Phase 3 — the review loop will catch remaining issues.
- **Abort** → set `status = "aborted"`, exit.

---

## Phase 3: Review-Fix Loop (max 5 iterations)

Autonomous loop — no user interaction until convergence, cap, or Critical finding.

```
iteration = 0
WHILE iteration < 5:
    iteration += 1

    1. git diff {target_branch}...{feature_branch}
       If empty → ERROR: no changes detected on feature branch.
       Report to user and break loop.
       /deep_review --base={target_branch} --head={feature_branch}
       On failure: retry once. If second failure, break loop and
       proceed to user gate with warning that review could not complete.

    2. Parse structured-findings. Map priorities:
       Critical → Critical, High → Major, Medium → Minor, Low → Suggestion.
       Write consolidated review to review_iteration_file path from state
       (overwritten each iteration).

    3. CONVERGED = 0 Critical + 0 Major + 0 Minor
       IF CONVERGED → break

    4. Critical → STOP the auto-loop. Present all findings with
       Critical highlighted at top. User chooses per-Critical:
       fix (with direction), dismiss (with rationale), or abort.
       If abort → Phase 4 (abort path).
       If dismiss → record in state findings.dismissed array with
       {id, severity, summary, rationale}.
       Major + Minor → queue for auto-fix.

    5. Spawn TddEngineer WITH FULL CONTEXT:
       subagent_type: full-orchestration:TddEngineer
       max_turns: 20
       prompt: |
         State file: .claude/swe-state/{ticket-id}.json
         Read state to locate:
         - stages.spec.spec_file
         - stages.spec.impl_plan_file
         - stages.spec.context_file
         - stages.implement.impl_summary_file
         - stages.review.review_iteration_file
         Findings to fix:
         {list with id, file:line, severity, summary}
         {user direction for Critical fixes if any}
         For each: write/update test, apply fix, run tests.
         Commit: "review: fix {severity} — {description}"
         Run full suite when done.
         Write updated summary to impl_summary_file.

       On TddEngineer failure:
       - Minor findings → demote to Suggestion (non-blocking).
       - Major findings → present to user: retry (with direction),
         dismiss (with rationale), or abort.
       Do not silently swallow failures.

    6. Update state: stages.review.iterations = iteration,
       update findings counts (total, fixed, auto_fixed, dismissed).

IF iteration == 5 AND NOT converged:
    Set stages.review.phase = "capped".
    Warn: "Review did not fully converge after 5 rounds. {N} findings remain."
```

Every review iteration is a **full-branch review** (`target_branch...feature_branch`). No incremental snapshots needed.

---

## Phase 4: User Approval Gate

Present review summary:
- Total iterations completed
- Phase reached (converged / capped)
- Findings: resolved count, auto-fixed count, remaining count, dismissed (with rationale)
- Follow-up items (suggestions)
- Test status (from TddEngineer's last run)

Warn if Critical or Major findings remain unresolved.

Write summary to `review_summary_file` path from state.

User chooses:
- **Approve** → proceed to Phase 5
- **Iterate** → capture user direction, spawn TddEngineer with full context (see below), then re-enter Phase 3 loop. Before re-entering the loop, set `iteration = min(iteration, 4)` so there is always at least 1 review pass after a user-requested revision.
- **Abort** → proceed to Phase 5 (abort path)

### Iterate: Full-Context TDD Engineer

Capture user direction verbatim.

```
subagent_type: full-orchestration:TddEngineer
max_turns: 20
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Iterating on implementation based on code review feedback.

  Read state to locate all inputs:
  - stages.spec.spec_file (original spec)
  - stages.spec.impl_plan_file (original plan)
  - stages.spec.context_file (codebase context)
  - stages.implement.impl_summary_file (previous impl summary)
  - stages.review.review_iteration_file (latest review feedback)

  User direction:
    {verbatim user instruction}

  Read the review feedback and impl summary to understand what
  needs to change. Use TDD. Keep all existing tests passing.
  Commit: "review: fix {severity} — {description}"
  Run full suite when done.
  Write updated summary to the impl_summary_file path from state.
```

After TddEngineer completes, return to Phase 3.

---

## Phase 5: Update State

Deep-merge into state:

- **Approve** → `stages.review.completed = true`, `stages.review.approved = true`, `stages.review.phase = "complete"`, populate findings counts (including `auto_fixed` and `dismissed`)
- **Abort** → `stages.review.approved = false`, `status = "aborted"`
