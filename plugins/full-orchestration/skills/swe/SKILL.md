---
name: swe
description: >-
  Run the full software engineering pipeline from ticket to PR.
  Use when starting a feature, fixing a bug from a ticket, or
  driving end-to-end development from a Jira, Linear, or GitHub
  issue. Accepts a ticket ID or URL as argument and orchestrates
  intake, spec design, TDD implementation, code review, and PR
  creation with approval gates at each stage.
---

# SWE Orchestrator

Coordinate the full software engineering pipeline: ticket intake, spec & design, TDD implementation, code review, and PR creation. Manages state, gates progression on user approval, and handles errors and resumption.

You give it a ticket ID. It gives you a reviewed PR.

## Usage

```
/swe PROJ-123
/swe https://github.com/org/repo/issues/42
/swe PROJ-123 --from=implement
/swe PROJ-123 --skip-review
```

---

## Phase 1: Parse Arguments

### Extract Ticket ID

Parse the first positional argument:
- If a URL, extract the ticket ID (Jira key from path, GitHub issue number, Linear ID)
- If a bare ID (`PROJ-123`, `#42`), use directly
- If no argument provided, show usage and exit

### Parse Flags

| Flag | Type | Effect |
|------|------|--------|
| `--from=STAGE` | string | Resume from a specific stage. Valid values: `intake`, `spec`, `implement`, `review`, `pr`. |
| `--skip-review` | boolean | Skip Stage 4 (Code Review). Jump from Stage 3 directly to Stage 5. |

### Validate

- No argument → show usage formats and exit
- Invalid `--from` value → list valid stages (`intake`, `spec`, `implement`, `review`, `pr`) and exit

---

## Phase 2: Initialize or Load State

### Fresh Run (no `--from` flag)

Detect the repository's default branch:

```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

If `gh` is unavailable, fall back to checking `git symbolic-ref refs/remotes/origin/HEAD` or default to `main`.

Create `.claude/swe-state/{ticket-id}.json`:

```json
{
  "ticket_id": "{ticket-id}",
  "target_branch": "{detected-default-branch}",
  "current_stage": "intake",
  "status": "in_progress",
  "stages": {
    "intake": { "completed": false },
    "spec": { "completed": false },
    "implement": { "completed": false },
    "review": { "completed": false },
    "pr": { "completed": false }
  }
}
```

### Resume (`--from` flag)

1. Load existing state from `.claude/swe-state/{ticket-id}.json`
2. If state file is missing, report error:
   ```
   No pipeline state found for {ticket-id}.
   Run /swe {ticket-id} to start a fresh pipeline, or /ticket_intake {ticket-id} for Stage 1 only.
   ```
3. Validate that all stages before the `--from` stage are completed. If not, report which stages are incomplete and suggest running from the earliest incomplete stage.

---

## Phase 3: Stage Dispatch Loop

### Stage Sequence

The full pipeline runs 5 stages in order:

```
intake → spec → implement → review → pr
```

Flags modify the sequence:
- `--skip-review` removes `review` from the sequence
- `--from=STAGE` sets the starting stage (all prior stages must be completed)

### Pre-Stage Validation

Before dispatching the `implement` stage, verify the user is on a feature branch:

```bash
current=$(git branch --show-current)
```

Compare `current` against `target_branch` from the state file. If they are the same (e.g., both `main`), stop and tell the user:

```
You are currently on the target branch ({target_branch}).
Stage 3 will commit directly to this branch, which is not recommended.

Create a feature branch first:
  git checkout -b feat/{ticket-id}

Then resume:
  /swe {ticket-id} --from=implement
```

Do NOT proceed to Stage 3 if the current branch is the target branch.

### Dispatch

Starting from the determined start stage, for each stage in the sequence:

1. **Display header:**
   ```
   ## Stage {N}: {Stage Name}
   ```

   | Stage Key | N | Stage Name |
   |-----------|---|------------|
   | `intake` | 1 | Ticket Intake |
   | `spec` | 2 | Spec & Design |
   | `implement` | 3 | TDD Implementation |
   | `review` | 4 | Code Review |
   | `pr` | 5 | PR Creation |

2. **Update state** — Set `current_stage` to this stage and `status` to `"in_progress"`. Write to disk.

3. **Invoke stage skill:**

   | Stage | Skill Invocation |
   |-------|-----------------|
   | `intake` | `/ticket_intake {ticket-id}` |
   | `spec` | `/spec_writer {ticket-id}` |
   | `implement` | `/tdd_implement {ticket-id}` |
   | `review` | `/code_review {ticket-id}` |
   | `pr` | `/pr_create {ticket-id}` |

4. **On stage success** — Mark the stage as completed in the state file. Proceed to the next stage.

   Each stage skill handles its own user interaction (approval prompts, change requests, iteration). The orchestrator does not add additional gates — it trusts the skills to return only when the user has approved the stage output.

5. **On stage failure** — Save state with `status: "failed"`, report the error, and suggest resumption:
   ```
   Stage {N} ({name}) failed: {error}

   Pipeline state saved. Resume with:
     /swe {ticket-id} --from={stage-key}
   ```

6. **On user abort** — If a stage skill reports that the user chose to abort, save state with `status: "aborted"` and exit:
   ```
   Pipeline aborted at Stage {N} ({name}).

   State saved. Resume later with:
     /swe {ticket-id} --from={stage-key}
   ```

---

## Phase 5: Completion

When all stages have completed (Stage 5 finishes), display the final summary:

```
## Pipeline Complete

**Ticket:** {ticket-id}
**PR:** {pr-url}
**Stages completed:** {list of completed stages}
**State file:** .claude/swe-state/{ticket-id}.json

All stages finished successfully.
```

Update state with `status: "completed"`.

---

## Error Handling

| Error | Behavior |
|-------|----------|
| Stage skill fails | Report the error, save state, suggest `/swe {ticket-id} --from={stage}` to retry |
| External plugin unavailable | Report which plugin is missing and show install command |
| MCP server not configured | Show setup command for the detected ticketing system (handled by `ticket_intake`) |
| Test suite fails in Stage 3 | The `tdd_implement` skill iterates internally; only surfaces to the orchestrator if unresolvable |
| Review finds critical issues | Stage 4 gate offers "Iterate" option to loop back to Stage 3 (with user approval) |
| Corrupted or missing state file | Report the error, offer to start fresh with `/swe {ticket-id}` |
| Missing argument | Show usage formats and exit |
| Invalid `--from` value | List valid stages and exit |

---

## State File Reference

The orchestrator reads and writes `.claude/swe-state/{ticket-id}.json`. Every write reads the existing file first and merges — prior stage data is never overwritten.

### Full Structure

```json
{
  "ticket_id": "PROJ-123",
  "target_branch": "main",
  "current_stage": "implement",
  "status": "awaiting_approval",
  "stages": {
    "intake": {
      "completed": true,
      "ticket_file": ".claude/swe-state/PROJ-123/ticket.json"
    },
    "spec": {
      "completed": true,
      "spec_file": ".claude/specs/PROJ-123.md",
      "impl_plan_file": ".claude/specs/PROJ-123-impl.md",
      "context_file": ".claude/specs/PROJ-123-context.md"
    },
    "implement": {
      "completed": false,
      "branch": null,
      "test_results": null
    },
    "review": {
      "completed": false,
      "approved": false,
      "iterations": 0,
      "findings": null
    },
    "pr": {
      "completed": false,
      "pr_number": null,
      "pr_url": null
    }
  }
}
```

### Status Values

| Value | Meaning |
|-------|---------|
| `in_progress` | A stage is currently running |
| `awaiting_approval` | A stage completed and is waiting for user approval at a gate |
| `approved` | User approved the gate; proceeding to next stage |
| `failed` | A stage encountered an error |
| `aborted` | User chose to abort at a gate |
| `completed` | All stages finished successfully |

### State Reads/Writes by Stage

| Stage | Reads | Writes |
|-------|-------|--------|
| 1 — Ticket Intake | Ticket ID (from CLI arg) | `ticket`: parsed requirements, acceptance criteria, affected areas |
| 2 — Spec & Design | `ticket` | `spec`: technical spec, `impl_plan`: implementation steps |
| 3 — TDD Implementation | `ticket`, `spec`, `impl_plan` | `branch`: name, `test_results`: pass/fail summary |
| 4 — Code Review | `branch` | `review`: consolidated findings, `approved`: boolean |
| 5 — PR Creation | `ticket`, `branch`, `review` | `pr_url`: the created PR URL |
