---
name: spec_writer
description: >-
  Generate a technical spec and implementation plan for a ticket. Use
  when you have parsed requirements and need a detailed design before
  implementation. Orchestrates codebase exploration, spec authoring,
  autonomous review-fix loops, implementation planning, and plan
  review-fix loops across multiple agents.
---

# Spec Writer

**State file**: `.claude/swe-state/{ticket-id}.json`

Orchestrate Stage 2: explore codebase, generate spec, review-fix loop, produce implementation plan, review-fix loop.

## Usage

```
/spec_writer <ticket-id>
```

Read `stages.intake.ticket_file` from state to locate the ticket. If `stages.intake.completed` is not true, tell the user to run `/ticket_intake` first.

---

## 2A: Codebase Exploration

Read ticket.json and extract `title`, `description`, `acceptance_criteria`, `labels`.

Select explorers based on labels:

| Ticket Type | Explorers | Count |
|---|---|---|
| Bug fix (`bug`, `fix`, `bugfix`) | Entity + Test + Pattern | 3 |
| New feature (`feature`, `enhancement`) | Entity + Dependency + Pattern + Test + Integration | 5 |
| Refactor (`refactor`, `cleanup`, `tech-debt`) | Entity + Dependency + Pattern | 3 |
| API change (`api`, `endpoint`, `rest`, `graphql`) | Entity + Dependency + Integration | 3 |
| Default | Entity + Dependency + Pattern + Test | 4 |

Spawn all selected explorers as `subagent_type: Explore` in a SINGLE message. Each gets:

```
Explore the codebase to find {topic} relevant to this ticket.
Ticket: {title} — {description}
Find: {search items}
Output a structured "{Section Name}" section.
```

| Explorer | Topic | Search Items | Output Section |
|---|---|---|---|
| Entity | entities | models, schemas, types, interfaces, fields, relationships | Entity Map |
| Dependency | dependencies | import chains, API boundaries, blast radius | Dependency Graph |
| Pattern | patterns | similar implementations, conventions, file organization | Existing Patterns |
| Test | test landscape | test structure, fixtures, mocks, coverage gaps | Test Landscape |
| Integration | integrations | external services, APIs, databases, config, env vars | External Integrations |

Merge outputs into `.claude/specs/{ticket-id}-context.md` (path from `stages.spec.context_file` in state).

---

## 2B: Spec Generation

```
subagent_type: full-orchestration:SpecArchitect
prompt: |
  Ticket: {ticket_file path from state}
  Context: {context_file path from state}
  Write spec to: {spec_file path from state}
```

---

## 2B↔2C: Spec Review-Fix Loop (max 5 rounds)

Autonomous loop — no user interaction until convergence or cap.

### Loop

```
iteration = 0
WHILE iteration < 5:
    iteration += 1

    1. Run /spec_review {spec_file path from state}
       → Returns OPEN comment count by severity
       On failure: retry once. If second failure, break loop and
       proceed to user gate with warning that review could not complete.

    2. IF 0 OPEN comments → CONVERGED → break

    3. Spawn author agent to address comments:
       subagent_type: full-orchestration:SpecArchitect
       prompt: |
         State file: .claude/swe-state/{ticket-id}.json
         Read state to locate: spec_file, context_file, and
         stages.intake.ticket_file.

         Review comments have been added to the spec. For each
         comment marked OPEN:
         1. Understand the reviewer's concern
         2. Reference the ticket and codebase context as needed
         3. Modify the relevant section to address it
         4. Change the comment status from OPEN to RESOLVED

         Do NOT delete comments. Do NOT add new content beyond
         addressing the comments. Do NOT change sections with no comments.

         When done, report: number of comments addressed, any you
         couldn't resolve (with explanation).

    4. Continue loop (next iteration re-reviews)

IF iteration == 5 AND OPEN comments remain:
    Report: "Spec review did not fully converge after 5 rounds.
    {N} OPEN comments remain."
```

### Cleanup

After loop exits (converged or capped):
1. Read the spec file
2. If capped with OPEN comments: extract all `> **[...|OPEN]**` lines and save as a list for the user gate
3. Remove all remaining blockquote comment lines matching `> **[...|RESOLVED]**` or `> **[...|OPEN]**`
4. Write the cleaned file back

Update state: `stages.spec.spec_review_iterations = {iteration count}`

### User Gate

Present the clean spec to the user. If OPEN comments remained at cap, show the extracted list separately.

User chooses:
- **Approve** → proceed to 2D
- **Request changes** → user provides direction, spawn SpecArchitect with direction (same state-referencing prompt as step 3 above, plus user direction appended), then re-enter the loop. The iteration counter does NOT reset — it continues from the current count toward the cap of 5.

---

## 2D: Implementation Planning

```
subagent_type: full-orchestration:ImplPlanner
prompt: |
  Spec: {spec_file path from state}
  Context: {context_file path from state}
  Write plan to: {impl_plan_file path from state}
```

---

## 2D↔2E: Impl Plan Review-Fix Loop (max 5 rounds)

Same loop mechanics as 2B↔2C, but targeting the implementation plan.

### Loop

```
iteration = 0
WHILE iteration < 5:
    iteration += 1

    1. Run /spec_review {impl_plan_file path from state}
       → Returns OPEN comment count by severity
       On failure: retry once. If second failure, break loop and
       proceed to user gate with warning that review could not complete.

    2. IF 0 OPEN comments → CONVERGED → break

    3. Spawn author agent to address comments:
       subagent_type: full-orchestration:ImplPlanner
       prompt: |
         State file: .claude/swe-state/{ticket-id}.json
         Read state to locate: impl_plan_file, spec_file,
         context_file, and stages.intake.ticket_file.

         Review comments have been added to the impl plan. For each
         comment marked OPEN:
         1. Understand the reviewer's concern
         2. Reference the spec, ticket, and codebase context as needed
         3. Modify the relevant section to address it
         4. Change the comment status from OPEN to RESOLVED

         Do NOT delete comments. Do NOT add new content beyond
         addressing the comments. Do NOT change sections with no comments.

         When done, report: number of comments addressed, any you
         couldn't resolve (with explanation).

    4. Continue loop (next iteration re-reviews)

IF iteration == 5 AND OPEN comments remain:
    Report: "Impl plan review did not fully converge after 5 rounds.
    {N} OPEN comments remain."
```

### Cleanup

After loop exits (converged or capped):
1. Read the impl plan file
2. If capped with OPEN comments: extract all `> **[...|OPEN]**` lines and save as a list for the user gate
3. Remove all remaining blockquote comment lines matching `> **[...|RESOLVED]**` or `> **[...|OPEN]**`
4. Write the cleaned file back

Update state: `stages.spec.impl_review_iterations = {iteration count}`

### User Gate

Present the clean impl plan to the user. If OPEN comments remained at cap, show the extracted list separately.

User chooses:
- **Approve** → proceed to Stage 3
- **Request changes** → user provides direction, spawn ImplPlanner with direction (same state-referencing prompt as step 3 above, plus user direction appended), then re-enter the loop. The iteration counter does NOT reset — it continues from the current count toward the cap of 5.

---

## Update State

Set `stages.spec.completed = true`. All file paths are already in state from initialization.
