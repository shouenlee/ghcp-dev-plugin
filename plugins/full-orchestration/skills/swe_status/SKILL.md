---
name: swe_status
description: >-
  Show the current state of an /swe pipeline run. Use when checking
  pipeline progress, resuming after an interruption, or reviewing
  what stage a ticket has reached. Accepts a ticket ID or lists all
  active pipelines if no argument given.
---

# SWE Status

Quick view of where a ticket is in the `/swe` pipeline.

## Usage

```
/swe-status PROJ-123       # Status for a specific ticket
/swe-status                # List all active pipelines
```

---

## Phase 1: Locate State

**With ticket ID**: Read `.claude/swe-state/{ticket-id}.json`. If not found, report "No pipeline state found for {ticket-id}" and exit.

**Without ticket ID**: List all `.json` files in `.claude/swe-state/` (excluding subdirectories). For each, read and display a one-line summary: `{ticket-id} | {current_stage} | {status}`. If none found, report "No active pipelines" and exit. If multiple found, show the list and ask the user to pick one. If exactly one found, use it automatically.

---

## Phase 2: Display Status

Read the full state file and present:

```
## Pipeline: {ticket-id}

**Status:** {status}  **Stage:** {current_stage}  **Branch:** {feature_branch} → {target_branch}

### Stage Progress

| Stage | Status | Details |
|-------|--------|---------|
| Intake | {icon} | {details} |
| Spec | {icon} | {details} |
| Implement | {icon} | {details} |
| Review | {icon} | {details} |
| PR | {icon} | {details} |
```

### Status Icons

- Completed: `done`
- In progress: `in progress` (current_stage matches)
- Pending: `pending`
- Failed/Aborted: `failed` / `aborted`

### Detail Lines Per Stage

**Intake**: ticket source and title (read ticket.json if it exists).

**Spec**: review iterations used. Example: `spec review: 2/5 rounds, impl review: 1/5 rounds`.

**Implement**: test result counts if available. Example: `12 new tests, suite PASS, 85% coverage`.

**Review**: iteration count, phase, and findings summary. Example: `3/5 rounds, converged — 0 critical, 2 major fixed, 1 dismissed`. If dismissed findings exist, list them: `Dismissed: {id} — {summary} ({rationale})`.

**PR**: PR URL if created. Example: `#42 — https://github.com/org/repo/pull/42`.

---

## Phase 3: Show Artifacts

List all pipeline artifacts that exist on disk:

```
### Artifacts
- Ticket: .claude/swe-state/{ticket-id}/ticket.json
- Context: .claude/specs/{ticket-id}-context.md
- Spec: .claude/specs/{ticket-id}.md
- Impl Plan: .claude/specs/{ticket-id}-impl.md
- Impl Summary: .claude/swe-state/{ticket-id}/impl-summary.md
- Review: .claude/swe-state/{ticket-id}/review-iteration.md
- Review Summary: .claude/swe-state/{ticket-id}/review-summary.md
```

Only show files that actually exist. Read paths from the state file — do not hardcode them. Mark missing files that should exist for the current stage (e.g., spec file missing but spec stage is completed).
