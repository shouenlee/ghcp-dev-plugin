---
name: pr-create
description: Create a GitHub pull request from the current branch with auto-generated title and description. Use when the user wants to create a PR, open a pull request, or submit changes for review.
---

# Create PR

Create a GitHub pull request from the current branch with an auto-generated title and description based on commit history.

## Usage

```
/pr-create [--target <branch>] [--draft] [--title "<title>"]
```

| Flag | Description |
|------|-------------|
| `--target <branch>` | Target branch (default: repository's default branch) |
| `--draft` | Create as a draft PR |
| `--title "<title>"` | Override the auto-generated title |

## Prerequisites

- Must be inside a git repository with a GitHub remote
- The `gh` CLI must be installed and authenticated (`gh auth status`)

---

## Workflow

### Step 1: Gather Branch Information

Get the current branch and verify it has commits to push:

```bash
git branch --show-current
```

If on `main` or `master`, warn the user — they probably want to create a feature branch first.

Check if the branch has been pushed to the remote:

```bash
git log --oneline origin/{branch}..HEAD 2>/dev/null
```

If there are unpushed commits, push the branch first:

```bash
git push -u origin {branch}
```

**Ask the user for confirmation** before pushing.

### Step 2: Determine Target Branch

If `--target` was specified, use that branch.

Otherwise, determine the default branch:

```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

### Step 3: Check for Existing PR

Check if a PR already exists for this source → target branch combination:

```bash
gh pr list --head {branch} --json number,url
```

If one exists, show the URL and ask the user if they want to update that PR instead of creating a new one.

### Step 4: Generate Title and Description

If `--title` was specified, use that.

Otherwise, generate a title from the commit history:

```bash
git log --oneline origin/{target}..HEAD
```

**Title rules:**
- If there's 1 commit, use the commit message as the title.
- If there are 2-5 commits, summarize the overall change in one line (under 70 chars).
- If there are 6+ commits, summarize the theme of the changes.

**Description:** Generate a markdown summary:

```markdown
## Summary

{2-3 bullet points summarizing what this PR does, derived from commit messages and changed files}

## Changes

{list of commits, from `git log --oneline`}

## Files Changed

{output of `git diff --stat origin/{target}..HEAD`}
```

If commit messages or the branch name reference issues (e.g., `fix-123`, `Fixes #456`), include `Fixes #<number>` in the description body to auto-link.

### Step 5: Confirm with User

Before creating the PR, show the user what will be created:

```markdown
## PR Preview

**Title:** {title}
**Source:** {branch} → **Target:** {target}
**Draft:** {yes/no}

### Description
{description}
```

Use AskUserQuestion to confirm:
- **Create** — proceed as shown
- **Edit** — let the user modify title/description
- **Cancel** — abort

### Step 6: Create the PR

```bash
gh pr create --title "{title}" --body "{description}" --base {target} [--draft]
```

### Step 7: Confirm

After creation, show:

```markdown
## PR Created

**PR #{number}:** {title}
**URL:** {url}
```

---

## Error Handling

- **`gh` not authenticated:** Suggest running `gh auth login`.
- **Not in a git repo:** Tell the user to navigate to a repository.
- **No commits ahead of target:** Nothing to create a PR for. Tell the user.
- **Branch already has a PR:** Warn if one exists and offer to update instead.
- **Push fails:** Remote rejection, authentication issues — show the error and suggest fixes.

## Safety

- **Always confirm before pushing** — the user may have unpushed commits they're not ready to share.
- **Always preview before creating** — show the full PR preview and let the user edit or cancel.
- **Do NOT create PRs without user confirmation.**
- **Do NOT push to protected branches** (main, master, release/*).
