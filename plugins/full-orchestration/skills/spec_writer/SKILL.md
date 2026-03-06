---
name: spec_writer
description: >-
  Generate a technical spec and implementation plan for a ticket. Use
  when you have parsed requirements and need a detailed design before
  implementation. Orchestrates codebase exploration, spec authoring,
  adversarial review, implementation planning, and plan review across
  multiple agents.
---

# Spec Writer

**State file**: `.claude/swe-state/{ticket-id}.json`

Orchestrate Stage 2: explore codebase, generate spec, review it, produce implementation plan, review that too.

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

**User gate**: Present spec, wait for approval. Iterate on changes.

---

## 2C: Spec Review

```
/spec_review {spec_file path from state}
```

**User gate**: Present findings. User can update spec and re-run, or approve.

---

## 2D: Implementation Planning

```
subagent_type: full-orchestration:ImplPlanner
prompt: |
  Spec: {spec_file path from state}
  Context: {context_file path from state}
  Write plan to: {impl_plan_file path from state}
```

**User gate**: Present plan, wait for approval. Iterate on changes.

---

## 2E: Plan Review

```
/spec_review {impl_plan_file path from state}
```

**User gate**: Present findings. This is the final gate before Stage 3. User can update plan and re-run, or approve.

---

## Update State

Set `stages.spec.completed = true`. All file paths are already in state from initialization.
