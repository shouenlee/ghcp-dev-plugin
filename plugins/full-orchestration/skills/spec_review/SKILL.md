---
name: spec_review
description: >-
  Run a four-agent review on a technical spec or implementation plan.
  Use when a spec or plan needs evaluation from maintainability,
  security, efficiency, and completeness perspectives. Spawns four
  reviewer agents that write structured comment files, then merges
  all comments into the document in a single conflict-free pass.
---

# Spec Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Four parallel reviewer agents each write a structured comment file. A single merge pass then inserts all comments into the document, avoiding parallel edit conflicts.

## Usage

```
/spec_review .claude/specs/PROJ-123.md          # Spec review (2C)
/spec_review .claude/specs/PROJ-123-impl.md     # Impl plan review (2E)
```

---

## Phase 1: Gather Context

**Detect mode** from path: `{ticket-id}.md` → spec mode, `{ticket-id}-impl.md` → impl mode. Extract ticket ID from the filename by stripping suffixes in order: `-impl.md`, `-context.md`, `.md`. The first match wins (e.g., `PROJ-123-impl.md` → strip `-impl.md` → `PROJ-123`; `PROJ-123.md` → strip `.md` → `PROJ-123`).

**Locate state**: `.claude/swe-state/{ticket-id}.json`. Read state to get: `stages.intake.ticket_file` and `stages.spec.context_file`.

**Read**: document under review (required), ticket.json (if available), context doc (if available).

---

## Phase 2: Parallel Review

Delete any existing comment files from prior invocations before starting:

```bash
rm -f .claude/swe-state/{ticket-id}/comments-*.json
```

Spawn FOUR agents in a SINGLE message. Each writes to its own comment file — no direct document edits.

```
subagent_type: full-orchestration:{ReviewerName}
max_turns: 10
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Review mode: {spec|impl}
  Comment file: .claude/swe-state/{ticket-id}/comments-{ReviewerName}.json

  Read state to locate the document under review:
  - spec mode: stages.spec.spec_file
  - impl mode: stages.spec.impl_plan_file

  Also read supporting context from state:
  - stages.intake.ticket_file
  - stages.spec.context_file

  The document may contain comments from prior review iterations
  (OPEN or RESOLVED). Follow your re-review instructions for those.
  Read the document and supporting files, then write your review
  comments to the comment file path above.
```

Agents: `MaintainabilityReviewer`, `SecurityReviewer`, `EfficiencyReviewer`, `CompletenessReviewer`.

On agent failure: log warning, proceed with remaining agents.

---

## Phase 3: Merge Comments

After all agents complete, merge their comment files into the document in a single pass. This avoids parallel edit conflicts.

1. Read all 4 comment files. Skip any that don't exist (agent may have failed or found no issues).
2. Read the document under review.
3. Process each entry across all files:

| Action | Operation |
|---|---|
| `add` | Find the line containing the `anchor` text. Insert `> **[{SEVERITY} \| {ReviewerName} \| OPEN]** {comment}` after the end of that paragraph (next blank line or heading). If anchor not found, append comment at the end of the document with a note. |
| `reopen` | Find the blockquote line matching `anchor`. Change `RESOLVED` to `OPEN`. If `comment` field is present, replace the comment text. |
| `remove` | Find and delete the blockquote line matching `anchor`. |

4. Write the updated document back.
5. Delete all 4 comment files (cleanup).

---

## Phase 4: Count and Report

Read the document and count blockquote comments matching:

```
> **[{SEVERITY} | {Reviewer} | OPEN]**
```

Report to caller:
- Count by severity: CRITICAL, HIGH, MEDIUM, LOW
- Total OPEN comments
- No verdict — the caller (spec_writer) decides convergence
