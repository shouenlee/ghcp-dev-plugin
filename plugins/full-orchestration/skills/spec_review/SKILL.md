---
name: spec_review
description: >-
  Run a four-agent adversarial review on a technical spec or
  implementation plan. Use when a spec or plan needs evaluation from
  maintainability, security, efficiency, and completeness
  perspectives. Spawns four reviewer agents in parallel and
  consolidates their findings into a single assessment.
---

# Spec Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Four parallel reviewer agents evaluate a document from different perspectives, then findings are consolidated.

## Usage

```
/spec_review .claude/specs/PROJ-123.md          # Spec review (2C)
/spec_review .claude/specs/PROJ-123-impl.md     # Impl plan review (2E)
```

---

## Phase 1: Gather Context

**Detect mode** from path: `{ticket-id}.md` → spec mode, `{ticket-id}-impl.md` → impl mode. Extract ticket ID (everything before first known suffix).

**Read state** to get paths: `stages.spec.spec_review_file` (spec mode) or `stages.spec.impl_review_file` (impl mode) for the output path. Also read `stages.intake.ticket_file` and `stages.spec.context_file`.

**Read**: document under review, ticket.json, context doc. Proceed with what's available — document under review is the minimum.

**Write shared context** to `.claude/swe-state/{ticket-id}/review-context.md`:

```markdown
# Review Context: {ticket-id}

## Review Metadata
- **Document path**: {path}
- **Review mode**: spec | impl

## Document Under Review
{full content}

## Ticket
{ticket.json content, or "Not available"}

## Codebase Context
{context doc content, or "Not available"}

## Instructions
Review from your specialized perspective. Use your corresponding review focus for mode "{review_mode}".
```

Verify the file exists before Phase 2.

---

## Phase 2: Parallel Review

Spawn FOUR agents in a SINGLE message:

```
subagent_type: full-orchestration:{ReviewerName}
prompt: |
  Read the review context: .claude/swe-state/{ticket-id}/review-context.md
  Produce your review in the format specified in your agent instructions.
```

Agents: `MaintainabilityReviewer`, `SecurityReviewer`, `EfficiencyReviewer`, `CompletenessReviewer`.

On agent failure: offer re-trigger, proceed without, or abort.

---

## Phase 3: Consolidation

1. **Group** findings by severity: CRITICAL → HIGH → MEDIUM → LOW
2. **Deduplicate**: merge same-issue findings, tag `[Multi-reviewer]` for 2+ agreement
3. **Write** consolidated review to the output path from state (`spec_review_file` or `impl_review_file`)

**Verdict**: PASS (zero CRITICAL + zero HIGH) or NEEDS REVISION.

Present summary to user: counts by severity, verdict, output file path.
