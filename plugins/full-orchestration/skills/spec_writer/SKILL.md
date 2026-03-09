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

Spawn all selected explorers as `subagent_type: Explore` with `model: haiku` and `max_turns: 10` in a SINGLE message. Each gets:

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

## Review-Fix Loop

This loop is used twice in this skill — once for the spec (2B↔2C) and once for the impl plan (2D↔2E). The steps are identical; only the parameters change.

### Parameters

| | Spec loop (2B↔2C) | Impl plan loop (2D↔2E) |
|---|---|---|
| **document** | `stages.spec.spec_file` | `stages.spec.impl_plan_file` |
| **author_agent** | `full-orchestration:SpecArchitect` | `full-orchestration:ImplPlanner` |
| **iteration_field** | `stages.spec.spec_review_iterations` | `stages.spec.impl_review_iterations` |
| **next phase** | 2D: Implementation Planning | Stage 3 |

### Steps

Start with `iteration = 0`.

**Step 1 — Review**: Increment `iteration`. Run `/spec_review {document path from state}`. On failure, retry once. If second failure, skip to Step 5 with a warning that review could not complete.

**Step 2 — Check convergence**: If `/spec_review` reports 0 OPEN comments, the document has converged. Skip to Step 5 for cleanup and user gate.

**Step 3 — Fix**: Spawn the author agent to address comments:

```
subagent_type: {author_agent}
max_turns: 15
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Read state to locate the document under review, context_file,
  and stages.intake.ticket_file.

  Review comments have been added to the document. For each
  comment marked OPEN:
  1. Understand the reviewer's concern
  2. Reference the ticket and codebase context as needed
  3. Modify the relevant section to address it
  4. Change the comment status from OPEN to RESOLVED

  Do NOT delete comments. Do NOT add new content beyond
  addressing the comments. Do NOT change sections with no comments.

  When done, report: number of comments addressed, any you
  couldn't resolve (with explanation).
```

**Step 4 — Update state**: Set `{iteration_field} = iteration` in the state file. If iteration < 5, go back to Step 1.

**Step 5 — Cleanup**: Read the document. If capped with OPEN comments, extract all `> **[...|OPEN]**` lines and save as a list for the user gate. Remove all blockquote comment lines matching `> **[...|RESOLVED]**` or `> **[...|OPEN]**`. Write the cleaned file back.

**Step 6 — User gate**: Present the clean document. If OPEN comments remained at cap, show the extracted list separately. User chooses:
- **Approve** → proceed to {next phase}
- **Request changes** → user provides direction, spawn {author_agent} with the Step 3 prompt plus user direction appended. Set `iteration = min(iteration, 4)` so there is at least 1 review pass after a user-requested revision. Go back to Step 1.

If iteration reaches 5 with OPEN comments remaining, report: "{N} OPEN comments remain after 5 rounds." Then proceed to Step 5.

---

## 2B: Spec Generation

```
subagent_type: full-orchestration:SpecArchitect
max_turns: 15
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Read state to locate: stages.intake.ticket_file, stages.spec.context_file,
  and stages.spec.spec_file.
  Read the ticket and context, then write the spec to the spec_file path.
```

After SpecArchitect completes, run the **Review-Fix Loop** with the **Spec** parameters.

---

## 2D: Implementation Planning

```
subagent_type: full-orchestration:ImplPlanner
max_turns: 15
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Read state to locate: stages.spec.spec_file, stages.spec.context_file,
  and stages.spec.impl_plan_file.
  Read the spec and context, then write the implementation plan to
  the impl_plan_file path.
```

After ImplPlanner completes, run the **Review-Fix Loop** with the **Impl plan** parameters.

---

## Update State

Set `stages.spec.completed = true`. All file paths are already in state from initialization.
