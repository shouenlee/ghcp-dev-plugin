---
name: spec_review
description: >-
  Run a four-agent inline comment review on a technical spec or
  implementation plan. Use when a spec or plan needs evaluation from
  maintainability, security, efficiency, and completeness perspectives.
  Spawns four reviewer agents that insert OPEN blockquote comments
  directly into the document.
---

# Spec Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Four parallel reviewer agents insert inline comments directly into the document under review.

## Usage

```
/spec_review .claude/specs/PROJ-123.md          # Spec review (2C)
/spec_review .claude/specs/PROJ-123-impl.md     # Impl plan review (2E)
```

---

## Phase 1: Gather Context

**Detect mode** from path: `{ticket-id}.md` → spec mode, `{ticket-id}-impl.md` → impl mode. Extract ticket ID (everything before first known suffix).

**Read state** to get: `stages.intake.ticket_file` and `stages.spec.context_file`.

**Read**: document under review (required), ticket.json (if available), context doc (if available).

---

## Phase 2: Parallel Inline Review

Spawn FOUR agents in a SINGLE message:

```
subagent_type: full-orchestration:{ReviewerName}
prompt: |
  Review this document by inserting inline comments: {doc_path}

  Supporting context:
  - Ticket: {ticket_file path from state}
  - Codebase context: {context_file path from state}

  Review mode: {spec|impl}
  Read the document and supporting files, then insert your review comments
  as inline blockquotes using your standard comment format.
```

Agents: `MaintainabilityReviewer`, `SecurityReviewer`, `EfficiencyReviewer`, `CompletenessReviewer`.

On agent failure: log warning, proceed with remaining agents.

---

## Phase 3: Count and Report

After all agents complete, read the document and count blockquote comments matching:

```
> **[{SEVERITY} | {Reviewer} | OPEN]**
```

Report to caller:
- Count by severity: CRITICAL, HIGH, MEDIUM, LOW
- Total OPEN comments
- No verdict — the caller (spec_writer) decides convergence
