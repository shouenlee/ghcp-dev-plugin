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

You give it a ticket ID. It gives you a reviewed PR.

## Usage

```
/swe PROJ-123
/swe https://github.com/org/repo/issues/42
```

---

## Phase 1: Parse Arguments

Parse the first positional argument:
- URL → extract ticket ID (Jira key from path, GitHub issue number, Linear ID)
- Bare ID (`PROJ-123`, `#42`) → use directly
- No argument → show usage and exit

---

## Phase 2: Initialize State

**Step 0 — Check plugin dependencies:**

Verify `/deep_review` is available (required for Stage 3). If unavailable, stop and show: `/plugin install deep-review@ghcp-dev-plugin`.

**Step 1 — Detect target branch:**

```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

Fallback: `git symbolic-ref refs/remotes/origin/HEAD`, then default to `main`.

**Step 2 — Ensure feature branch:**

```bash
current=$(git branch --show-current)
```

If on the target branch, ask user to confirm creating `feat/{ticket-id}`. If on a different branch, use it as the feature branch.

**Step 3 — Create directories:**

```bash
mkdir -p .claude/swe-state/{ticket-id}
mkdir -p .claude/specs
```

**Step 4 — Write full state file** to `.claude/swe-state/{ticket-id}.json`:

```json
{
  "ticket_id": "{ticket-id}",
  "target_branch": "{detected}",
  "feature_branch": "{current-or-created}",
  "current_stage": "intake",
  "status": "in_progress",
  "stages": {
    "intake": {
      "completed": false,
      "ticket_file": ".claude/swe-state/{ticket-id}/ticket.json"
    },
    "spec": {
      "completed": false,
      "spec_file": ".claude/specs/{ticket-id}.md",
      "impl_plan_file": ".claude/specs/{ticket-id}-impl.md",
      "context_file": ".claude/specs/{ticket-id}-context.md",
      "spec_review_iterations": 0,
      "impl_review_iterations": 0
    },
    "implement": {
      "completed": false,
      "impl_summary_file": ".claude/swe-state/{ticket-id}/impl-summary.md",
      "test_results": {
        "new_tests": 0,
        "modified_tests": 0,
        "total_suite": null,
        "coverage": null
      }
    },
    "review": {
      "completed": false,
      "approved": false,
      "iterations": 0,
      "phase": "pending",
      "review_iteration_file": ".claude/swe-state/{ticket-id}/review-iteration.md",
      "review_summary_file": ".claude/swe-state/{ticket-id}/review-summary.md",
      "findings": {
        "critical": { "total": 0, "fixed": 0, "dismissed": 0 },
        "major": { "total": 0, "fixed": 0, "auto_fixed": 0, "dismissed": 0 },
        "minor": { "total": 0, "fixed": 0, "auto_fixed": 0 },
        "suggestions": 0,
        "dismissed": []
      }
    },
    "pr": {
      "completed": false,
      "pr_number": null,
      "pr_url": null,
      "title": null,
      "labels": [],
      "ticket_updated": false,
      "reviewers_requested": false
    }
  }
}
```

This is the **single source of truth** for the pipeline. All file paths are pre-populated — downstream skills read paths from state, never construct them. Fields with `null`, `false`, `0`, or `[]` are populated by the owning stage.

---

## Phase 3: Stage Dispatch Loop

Pipeline runs 4 stages in order: `intake → spec → implement_and_review → pr`

For each stage in order:

1. Display `## Stage {N}: {Name}`
2. Set `current_stage` and `status: "in_progress"` in state
3. Invoke the stage skill:

| Stage | Skill |
|---|---|
| `intake` | `/ticket_intake {ticket-id}` |
| `spec` | `/spec_writer {ticket-id}` |
| `implement_and_review` | `/implement_and_review {ticket-id}` |
| `pr` | `/pr_create {ticket-id}` |

4. **Success** → proceed
5. **Failure** → set `status: "failed"`, report which stage failed
6. **User abort** → set `status: "aborted"`, exit

Each skill handles its own user interaction and state writes.

---

## Phase 4: Completion

```
## Pipeline Complete

**Ticket:** {ticket-id}
**PR:** {pr-url}
**State:** .claude/swe-state/{ticket-id}.json
```

Set `status: "completed"`.

> **Tip:** Use `/swe-status {ticket-id}` at any time to check pipeline progress.
