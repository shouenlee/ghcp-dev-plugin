---
name: spec_writer
description: "Generate a technical spec and implementation plan for a ticket. Use when you have parsed requirements and need a detailed design before implementation. Orchestrates codebase exploration, spec authoring, adversarial review, implementation planning, and plan review across multiple agents."
---

# Spec Writer

Orchestrate the full Stage 2 pipeline: explore the codebase, generate a technical spec, review it, produce an implementation plan, and review that too.

## Usage

```
/spec_writer <ticket-id>
```

The ticket must already exist at `.claude/swe-state/{ticket-id}/ticket.json` (produced by Stage 1 `/ticket_intake`).

---

## Prerequisites

1. **Ticket file**: `.claude/swe-state/{ticket-id}/ticket.json` must exist
   - If missing, tell the user: "No ticket found. Run `/ticket_intake {ticket-id}` first."
2. **Specs directory**: `.claude/specs/` — create if it doesn't exist

---

## Sub-stage 2A: Codebase Exploration

### Read Ticket

Read `.claude/swe-state/{ticket-id}/ticket.json` and extract:
- `title`, `description`, `acceptance_criteria`, `labels`

### Select Explorers

Choose explorer agents based on ticket labels and content:

| Ticket Type | Explorers | Count |
|---|---|---|
| Bug fix (`bug`, `fix`, `bugfix`) | Entity + Test + Pattern | 3 |
| New feature (`feature`, `enhancement`) | Entity + Dependency + Pattern + Test + Integration | 5 |
| Refactor (`refactor`, `cleanup`, `tech-debt`) | Entity + Dependency + Pattern | 3 |
| API change (`api`, `endpoint`, `rest`, `graphql`) | Entity + Dependency + Integration | 3 |
| Default (no matching labels) | Entity + Dependency + Pattern + Test | 4 |

### Spawn Explorers

Spawn selected explorers as **Explore subagents** in a SINGLE message. These are NOT plugin-defined agents — they are prompt-only Explore agents with focused instructions.

**Entity Explorer**:
```
subagent_type: Explore
prompt: |
  Explore the codebase to map entities relevant to this ticket.
  Ticket: {title} — {description}
  Find: models, schemas, types, interfaces that will be touched or created.
  For each entity: list fields, relationships, validation rules, and file locations.
  Output a structured "Entity Map" section.
```

**Dependency Explorer**:
```
subagent_type: Explore
prompt: |
  Explore the codebase to map dependencies relevant to this ticket.
  Ticket: {title} — {description}
  Find: import chains, API boundaries, downstream consumers of affected code.
  Trace what depends on what. Determine the blast radius of changes.
  Output a structured "Dependency Graph" section.
```

**Pattern Explorer**:
```
subagent_type: Explore
prompt: |
  Explore the codebase to find patterns relevant to this ticket.
  Ticket: {title} — {description}
  Find: how similar features were implemented, coding conventions, file organization patterns.
  For each pattern: show file references and code snippets.
  Output a structured "Existing Patterns" section.
```

**Test Explorer**:
```
subagent_type: Explore
prompt: |
  Explore the codebase to map the test landscape for this ticket.
  Ticket: {title} — {description}
  Find: test structure, test file locations, fixture patterns, mock patterns, coverage gaps.
  For affected areas: list existing tests, their types (unit/integration/e2e), and what they cover.
  Output a structured "Test Landscape" section.
```

**Integration Explorer**:
```
subagent_type: Explore
prompt: |
  Explore the codebase to map external integrations relevant to this ticket.
  Ticket: {title} — {description}
  Find: external services, APIs, databases, config files, environment variables.
  For each integration: show connection details, auth patterns, config locations.
  Output a structured "External Integrations" section.
```

### Merge into Context Document

Collect all explorer outputs and merge into a single document at `.claude/specs/{ticket-id}-context.md`:

```markdown
# Codebase Context: {ticket-id}

## Entity Map
<Entity Explorer output>

## Dependency Graph
<Dependency Explorer output — if run>

## Existing Patterns
<Pattern Explorer output — if run>

## Test Landscape
<Test Explorer output — if run>

## External Integrations
<Integration Explorer output — if run>

## Key Observations
<Cross-cutting findings that emerged from multiple explorers>
```

---

## Sub-stage 2B: Spec Generation

Spawn the spec architect agent:

```
subagent_type: full-orchestration:SpecArchitect
prompt: |
  You are the SPEC ARCHITECT.
  Ticket: .claude/swe-state/{ticket-id}/ticket.json
  Context: .claude/specs/{ticket-id}-context.md
  Write the spec to: .claude/specs/{ticket-id}.md
```

### User Approval Gate

After the spec is generated, present it to the user:

```
Technical spec generated: .claude/specs/{ticket-id}.md

Please review the spec above. You can:
- Ask questions about specific sections
- Request changes or alternatives
- Add constraints or requirements
- Say "approved" to proceed to review
```

Wait for user approval before proceeding. Iterate if the user requests changes.

---

## Sub-stage 2C: Spec Review

Once the user approves the spec, run the review team:

```
/spec_review .claude/specs/{ticket-id}.md
```

### User Review Gate

Present the consolidated review to the user:

```
Spec review complete. See findings above.

You can:
- Update the spec based on findings and re-run the review
- Acknowledge findings and approve to proceed
- Override specific findings with rationale

Say "approved" to proceed to implementation planning.
```

If the user updates the spec, re-run `/spec_review` on the updated version.

---

## Sub-stage 2D: Implementation Planning

Spawn the implementation planner agent:

```
subagent_type: full-orchestration:ImplPlanner
prompt: |
  You are the IMPLEMENTATION PLANNER.
  Spec: .claude/specs/{ticket-id}.md
  Context: .claude/specs/{ticket-id}-context.md
  Write the implementation plan to: .claude/specs/{ticket-id}-impl.md
```

### User Approval Gate

After the impl doc is generated, present it to the user:

```
Implementation plan generated: .claude/specs/{ticket-id}-impl.md

Please review the plan above. You can:
- Request changes to the implementation order
- Ask for more detail on specific steps
- Adjust test cases
- Say "approved" to proceed to review
```

Wait for user approval before proceeding.

---

## Sub-stage 2E: Implementation Doc Review

Once the user approves the impl doc, run the review team:

```
/spec_review .claude/specs/{ticket-id}-impl.md
```

### Final Approval Gate

Present the consolidated review:

```
Implementation plan review complete. See findings above.

This is the final gate before Stage 3 (TDD Implementation).

You can:
- Update the plan and re-run the review
- Acknowledge findings and approve to proceed to Stage 3
- Override specific findings with rationale

Say "approved" to proceed to implementation.
```

---

## Update Pipeline State

After the user approves the implementation plan (end of Sub-stage 2E), update `.claude/swe-state/{ticket-id}.json`:

```json
{
  "current_stage": "spec",
  "stages": {
    "spec": {
      "completed": true,
      "spec_file": ".claude/specs/{ticket-id}.md",
      "impl_plan_file": ".claude/specs/{ticket-id}-impl.md",
      "context_file": ".claude/specs/{ticket-id}-context.md",
      "explorers_run": 0,
      "spec_review_iterations": 0,
      "plan_review_iterations": 0
    }
  }
}
```

Read the existing state file first and merge — do not overwrite prior stage data (e.g., `stages.intake`).

---

## Error Handling

- **Agent failure**: Offer to re-spawn the failed agent or proceed without it
- **Missing ticket file**: Direct user to run `/ticket_intake {ticket-id}` first
- **User skip**: User can say "skip" at any sub-stage gate with a warning:
  ```
  Warning: Skipping {sub-stage} may reduce quality. Proceeding to {next-stage}.
  ```

## Artifacts Produced

| File | Sub-stage | Contents |
|---|---|---|
| `.claude/specs/{ticket-id}-context.md` | 2A | Codebase context from explorers |
| `.claude/specs/{ticket-id}.md` | 2B | Technical spec |
| `.claude/specs/{ticket-id}-review-spec.md` | 2C | Consolidated spec review |
| `.claude/specs/{ticket-id}-impl.md` | 2D | Implementation plan |
| `.claude/specs/{ticket-id}-review-impl.md` | 2E | Consolidated impl doc review |
