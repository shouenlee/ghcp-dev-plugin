---
name: pr_create
description: >-
  Create a pull request from a reviewed implementation branch. Use
  when the implementation and review stage is approved and you are
  ready to open a PR. Generates a conventional-commit title, structured body with
  ticket link, spec summary, test results, and review findings, then
  creates the PR via gh CLI.
---

# PR Creation

**State file**: `.claude/swe-state/{ticket-id}.json`

Create a well-structured PR from the reviewed implementation.

## Usage

```
/pr_create <ticket-id>
```

---

## Phase 1: Validate and Gather

Read state. Confirm `stages.review.approved` is true (not just `completed` — an aborted review is completed but not approved). Extract `feature_branch`, `target_branch`. Read ticket.json for ticket URL and source system. Read impl summary and review summary. Verify feature branch exists.

Report: ticket ID, branches, ticket URL, review iteration count.

---

## Phase 2: Generate PR Content

**Title**: `{type}({ticket-id}): {description}` — under 72 chars.

Type mapping: feature→`feat`, bug→`fix`, refactor→`refactor`, docs→`docs`, test-only→`test`, chore→`chore`.

**Labels**: feature→`enhancement`, bug→`bug`, refactor→`refactor`, docs→`docs`, test→`test`, security fix→`security`.

**Body** — assemble from pipeline artifacts:

```markdown
## Summary
{2-3 sentences}
Resolves [{ticket-id}]({ticket-url})

## Spec
**Goal**: {from spec}  **Approach**: {summary}
**Key decisions**: {list}

## Changes
- `{file}` — {description}

## Test Results
{from impl summary}

## Review Summary
{iterations, findings table, resolutions}

## Checklist
- [x] Tests pass locally
- [x] Code review completed
- [x] No critical/major findings remaining
- [ ] CI pipeline (pending)
```

**Preview gate**: Show title, labels, body. User chooses: Create, Edit, or Cancel.

---

## Phase 3: Create PR

1. **History cleanup** (optional): Show commit count on feature branch (`git rev-list --count {target_branch}..{feature_branch}`). If more than 1 commit, ask user:
   - **Keep all commits** → proceed as-is
   - **Squash into one commit** → `git reset --soft {target_branch} && git commit -m "{pr_title}"` (with user confirmation since this rewrites history)
   - **Skip** → proceed as-is
2. **Rebase check**: Fetch latest target branch and check for divergence:
   ```bash
   git fetch origin {target_branch}
   git merge-base --is-ancestor origin/{target_branch} HEAD
   ```
   If target has moved ahead, rebase: `git rebase origin/{target_branch}`. On conflict → present conflicting files to user and pause. Do NOT force-push or auto-resolve.
3. **Push** (with user confirmation): `git push -u origin {feature_branch}`
4. **Check existing**: `gh pr list --head {feature_branch} --json number,url` — offer to update if exists
5. **Create**: `gh pr create --title "{title}" --body "{body}" --base {target_branch}`
6. **Labels**: `gh pr edit {number} --add-label "{labels}"`

---

## Phase 4: Update Ticket (non-fatal)

| System | Action |
|---|---|
| Jira | MCP: `transitionJiraIssue` to "In Review" + `addCommentToJiraIssue` |
| Linear | MCP: `linear_update_issue` to "In Review" + `linear_add_comment` |
| GitHub | Auto-linked via `Resolves #N`; add comment with `gh issue comment` |

---

## Phase 5: Post-PR

Request reviewers from CODEOWNERS if available: `gh pr edit {number} --add-reviewer {list}`. Report CI monitoring command.

---

## Phase 6: Update State

Set `stages.pr.completed = true`, populate `pr_number`, `pr_url`, `title`, `labels`, `ticket_updated`, `reviewers_requested`. Set `status = "completed"`.
