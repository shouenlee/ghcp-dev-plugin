---
name: pr_create
description: "Create a pull request from a reviewed implementation branch. Use when Stage 4 code review is approved and you are ready to open a PR. Generates a conventional-commit title, structured body with ticket link, spec summary, test results, and review findings, then creates the PR via gh CLI."
---

# PR Creation

Orchestrate Stage 5 of the software engineering pipeline: take the reviewed, approved implementation from Stage 4 and create a well-structured pull request with full traceability from ticket to implementation.

## Usage

```
/pr_create <ticket-id>
```

---

## Prerequisites

Validate that these files exist before proceeding:

1. **Review Summary**: `.claude/swe-state/{ticket-id}/review-summary.md`
2. **Implementation Summary**: `.claude/swe-state/{ticket-id}/impl-summary.md`
3. **Pipeline State**: `.claude/swe-state/{ticket-id}.json`

Read `.claude/swe-state/{ticket-id}.json` and confirm `stages.review.approved` is `true`.

If any prerequisite is missing or Stage 4 review is not approved, stop and tell the user:

```
Missing prerequisites for PR creation.

Required:
  - .claude/swe-state/{ticket-id}/review-summary.md   (review summary)
  - .claude/swe-state/{ticket-id}/impl-summary.md     (implementation summary)
  - .claude/swe-state/{ticket-id}.json                 (pipeline state with stages.review.approved = true)

Run /code_review {ticket-id} to complete review first.
```

---

## Phase 1: Validate Inputs

1. Read `.claude/swe-state/{ticket-id}.json`
2. Extract the **feature branch name** from `feature_branch` (top-level field)
3. Extract the **target branch** from `target_branch` in the state file (default: `main` if not set)
4. Extract **ticket data**: ticket ID, ticket URL, ticketing system (jira/linear/github)
5. Read `.claude/swe-state/{ticket-id}/impl-summary.md` — extract test results, changes list
6. Read `.claude/swe-state/{ticket-id}/review-summary.md` — extract findings, iterations, resolutions
7. Read the spec file if referenced in state — extract spec summary
8. Verify the feature branch exists: `git branch --list <branch>`
9. Report to the user:

```
PR Creation: {ticket-id}
  Branch: {feature-branch}
  Target: {target-branch}
  Ticket: {ticket-url}
  Review: Approved ({iterations} iteration(s), {findings-resolved} findings resolved)

Generating PR content...
```

---

## Phase 2: Generate PR Content

### Title

Generate a conventional-commit title:

```
{type}({ticket-id}): {description}
```

- **Type mapping** from ticket/change characteristics:

| Change Type | Prefix |
|-------------|--------|
| New feature | `feat` |
| Bug fix | `fix` |
| Refactor | `refactor` |
| Documentation | `docs` |
| Test-only | `test` |
| Chore/maintenance | `chore` |

- **Scope**: the ticket ID (e.g., `PROJ-123`, `LIN-456`, `#78`)
- **Description**: concise summary, total title under 72 characters

### Labels

Determine labels based on change type:

| Change Type | Label |
|-------------|-------|
| New feature | `enhancement` |
| Bug fix | `bug` |
| Refactor | `refactor` |
| Documentation | `docs` |
| Test-only | `test` |
| Security fix | `security` |

### Body

Assemble a structured PR body from pipeline artifacts:

```markdown
## Summary

{2-3 sentence summary of what was built and why}

Resolves [{ticket-id}]({ticket-url})

## Spec

**Goal**: {goal from spec}

**Approach**: {approach summary}

**Key decisions**:
- {decision 1}
- {decision 2}

## Changes

- `{file}` — {description of change}
- ...

## Test Results

```
Tests:  {passed} passed, {failed} failed
Suites: {suite-count} passed
Time:   {duration}
```

## Review Summary

Reviewed by: {reviewer agents}

| Finding | Severity | Resolution |
|---------|----------|------------|
| {finding} | {severity} | {resolution} |

## Checklist

- [x] Tests pass locally
- [x] Code review completed ({iterations} iteration(s))
- [x] No critical or major findings remaining
- [ ] CI pipeline (pending)
```

### Preview and Confirm

Show the full PR preview (title, labels, body) and ask the user to choose:

- **Create** — proceed with PR creation
- **Edit** — let the user modify the title or body before creating
- **Cancel** — abort PR creation; pipeline state is unchanged

---

## Phase 3: Create PR

### 3.1 Push Branch

Push the feature branch to the remote if it hasn't been pushed yet:

```bash
git push -u origin {feature-branch}
```

**Ask the user for confirmation** before pushing.

### 3.2 Check for Existing PR

```bash
gh pr list --head {feature-branch} --json number,url
```

If a PR already exists, show the existing PR URL and offer to update its description instead of creating a new one.

### 3.3 Create the PR

```bash
gh pr create --title "{title}" --body "{body}" --base {target-branch}
```

Where `{body}` is the structured PR body assembled in Phase 2.

### 3.4 Apply Labels

```bash
gh pr edit {pr_number} --add-label "{label1},{label2}"
```

### 3.5 Capture Result

Extract the PR number and URL from the `gh pr create` output.

---

## Phase 4: Update Ticket Status

Based on the detected ticketing system, update the source ticket. All ticket updates are **non-fatal** — warn and continue on failure.

### Jira

```
MCP tool: atlassian_jira_transition_issue
  issue_key: {ticket-id}
  transition: "In Review"

MCP tool: atlassian_jira_add_comment
  issue_key: {ticket-id}
  body: "PR created: {pr_url}\n\nChanges: {summary}"
```

### Linear

```
MCP tool: linear_update_issue
  issue_id: {ticket-id}
  status: "In Review"

MCP tool: linear_create_comment
  issue_id: {ticket-id}
  body: "PR created: {pr_url}\n\nChanges: {summary}"
```

### GitHub Issues

No MCP needed — the `Resolves #{issue-number}` line in the PR body auto-links the issue. Add an explicit comment:

```bash
gh issue comment {issue-number} --body "PR created: {pr_url}"
```

---

## Phase 5: Post-PR Actions

1. **Request reviewers** — If the project has a `.github/CODEOWNERS` file or configured reviewer list, request reviews:
   ```bash
   gh pr edit {pr_number} --add-reviewer {reviewer1},{reviewer2}
   ```
   Skip if no reviewers are configured.

2. **Report CI monitoring** — The PR creation triggers CI automatically. Report the monitoring command (non-blocking):
   ```
   CI checks running. Monitor with:
     gh pr checks {pr_number} --watch
   ```

---

## Phase 6: Update Pipeline State

Update `.claude/swe-state/{ticket-id}.json` with Stage 5 results:

```json
{
  "current_stage": "pr",
  "status": "completed",
  "stages": {
    "pr": {
      "completed": true,
      "pr_number": 0,
      "pr_url": "",
      "title": "",
      "labels": [],
      "ticket_updated": false,
      "reviewers_requested": false
    }
  }
}
```

Read the existing state file first and merge — do not overwrite prior stage data.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `gh auth` failure | Prompt user to run `gh auth login`; preserve all artifacts for manual PR creation |
| Branch conflict | Offer to rebase the feature branch; ask user before force-pushing |
| PR already exists | Show existing PR URL; offer to update the description instead |
| MCP ticket update fails | Log warning; continue without ticket update; suggest re-running MCP setup |
| Label application fails | Log warning; continue — labels can be added manually |
| Push rejected | Show error; suggest checking repository permissions |

Post-creation errors (Phases 4–5) are non-fatal. The orchestrator preserves all artifacts so the user can complete these steps manually if needed.

---

## Artifacts Produced

| File | Contents |
|---|---|
| `.claude/swe-state/{ticket-id}.json` | Updated pipeline state with PR details |

All other artifacts (review summary, impl summary, spec) are read-only inputs from prior stages.

---

## Completion

Report the final status:

```
PR Created: {ticket-id}

  PR:      {pr_url}
  Labels:  {labels}
  Ticket:  {ticket-status-update-result}
  CI:      Pending — gh pr checks {pr_number} --watch

Pipeline complete. No further stages.
```

This is the final stage — no handoff.
