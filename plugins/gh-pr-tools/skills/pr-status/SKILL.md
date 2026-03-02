---
name: pr-status
description: Show a quick summary of PR review thread statuses on GitHub. Use when the user wants to check PR status, see remaining comments, review thread summary, or triage before resolving.
---

# PR Status

Show a quick read-only summary of review thread statuses on a GitHub pull request.
No files are modified — this is purely informational.

## Usage

```
/pr-status <PR-number-or-URL>
```

No flags — this is a lightweight status check.

## Prerequisites

- Must be inside a git repository with a GitHub remote
- The `gh` CLI must be installed and authenticated (`gh auth status`)

## Input Parsing

Accept any of these formats:
- **PR number:** `123` or `#123`
- **PR URL:** `https://github.com/{owner}/{repo}/pull/{number}`
- **No argument:** Detect from the current branch via `gh pr view --json number --jq '.number'`

---

## Workflow

### Step 1: Fetch PR Data

Fetch PR metadata and review threads in parallel:

**PR metadata (REST):**

```bash
gh pr view <number> --json title,author,state,baseRefName,headRefName,reviewDecision,reviews
```

**Review threads (GraphQL):**

```bash
gh api graphql -f query='
  query($owner:String!, $repo:String!, $pr:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$pr) {
        reviewThreads(first:100) {
          nodes {
            isResolved
            isOutdated
            comments(first:10) {
              nodes {
                body
                author { login }
                path
                line
              }
            }
          }
        }
      }
    }
  }' -f owner='{owner}' -f repo='{repo}' -F pr='{number}'
```

Use `gh repo view --json owner,name --jq '.owner.login + " " + .name'` to get owner and repo dynamically.

### Step 2: Categorize Threads

For each review thread, determine its status:

| Status | Meaning |
|--------|---------|
| Unresolved (`isResolved == false`) | Needs attention |
| Resolved (`isResolved == true`) | Addressed |
| Outdated (`isOutdated == true`) | Code has changed since comment |

Also categorize by whether the thread has file context (`path` is set) or is a general PR-level comment.

**Bot detection:** Filter out threads where the comment author login ends with `[bot]` (e.g., dependabot, github-actions, codeql, codecov, renovate).

### Step 3: Present Summary

```markdown
## PR #<number> - <title>

**Source:** <headRefName> → **Target:** <baseRefName>
**State:** <state> | **Author:** <author> | **Review decision:** <reviewDecision>

### Review Threads

| Status | Count |
|--------|-------|
| Unresolved | <n> |
| Resolved | <n> |
| Outdated | <n> |
| Total | <n> |

### Reviews

| Reviewer | State |
|----------|-------|
| <login> | APPROVED / CHANGES_REQUESTED / COMMENTED |

### Unresolved Threads (<count>)
| File | Line | Reviewer | Comment |
|------|------|----------|---------|
| <path> | <line> | <author> | <first 80 chars of comment> |

### General Comments (<count>)
- <comment text>
```

If there are no unresolved threads, say: "All review threads are resolved."

If there are unresolved threads, suggest: "Run `/resolve-pr <number>` to address these comments."

---

## Error Handling

- **`gh` not authenticated:** Suggest running `gh auth login`.
- **PR not found:** Verify the number/URL and check access permissions.
- **No PR for current branch:** Ask the user to specify a PR number explicitly.
