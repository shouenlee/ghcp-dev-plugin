---
name: pr-description
description: 'Generates structured PR descriptions from branch diffs — includes summary, changes grouped by concern, testing instructions, and deploy notes. Use when asked to "write pr description", "generate pr description", "pr desc", "describe this pr", "pr body", or before creating a pull request.'
---

# PR Description

Generate structured, comprehensive pull request descriptions from branch diffs. Produces a ready-to-use PR body with summary, grouped changes, testing instructions, and deploy notes.

## When to Use

- You are about to create a pull request and need a well-structured description
- You want to summarize the changes on your branch for reviewers
- You need to document testing instructions and deploy considerations
- You want to auto-generate a PR body to pipe into `gh pr create`

## Prerequisites

- A **git repository** with commits ahead of the base branch
- **git** CLI available
- **gh** CLI available (optional, for creating the PR directly)

## Workflow

1. **Detect the base branch** by checking the remote HEAD reference:

   ```bash
   git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'
   ```

   If this fails, default to `main` or `master` based on which branch exists.

2. **Get the commit log** for the current branch since it diverged from base:

   ```bash
   git log <base>..HEAD --oneline
   ```

3. **Get the full diff** to understand the scope and details of all changes:

   ```bash
   git diff <base>...HEAD
   ```

4. **Get the list of changed files** to understand which areas are affected:

   ```bash
   git diff <base>...HEAD --name-only
   ```

5. **Analyze the commits and diff** to understand:
   - What changed and why (from commit messages and code context)
   - Which components or concerns are affected
   - Whether there are breaking changes, migrations, or config changes
   - Any issue references in commit messages or the branch name

6. **Generate a structured PR description** with the following sections:

   - **Summary**: 1-3 sentence overview of what the PR does and why. Focus on the purpose, not the implementation details.

   - **Changes**: Bullet points grouped by concern. Common groupings include:
     - API Changes
     - Database / Migrations
     - Frontend / UI
     - Backend / Business Logic
     - Tests
     - Configuration / Infrastructure
     - Documentation

   - **Testing Instructions**: Step-by-step instructions for the reviewer to verify the changes work correctly. Include specific commands, URLs, or scenarios to test.

   - **Deploy Notes**: Any migration steps, new environment variables, infrastructure changes, or sequencing requirements needed for deployment. Omit this section entirely if there are no deploy considerations.

   - **Related Issues**: Issue references extracted from commit messages (e.g., `Fixes #123`, `Closes #456`) or the branch name (e.g., `feature/JIRA-789-add-auth`).

7. **Output the description** in markdown format, ready to paste into a PR or pipe into a CLI command:

   ```bash
   gh pr create --title "<title>" --body "<description>"
   ```

8. **Offer to create the PR directly** using the gh CLI:

   ```bash
   gh pr create --title "<generated title>" --body "<generated description>"
   ```

   Confirm with the user before executing the command.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `fatal: not a git repository` | Not inside a git repo | Navigate to the project root directory |
| Cannot detect base branch | `refs/remotes/origin/HEAD` is not set | Run `git remote set-head origin --auto` or specify the base branch manually |
| Empty diff / no commits | Current branch is up to date with base | Ensure you have commits ahead of the base branch; check with `git log <base>..HEAD` |
| `gh: command not found` | GitHub CLI is not installed | Install from https://cli.github.com/ or use the generated description manually |
| `gh pr create` fails with auth error | Not authenticated with GitHub | Run `gh auth login` to authenticate |
| Description is too generic | Commit messages lack detail | Write more descriptive commit messages or provide context when invoking the skill |
| Wrong base branch detected | Remote HEAD points to unexpected branch | Specify the base branch explicitly when invoking the skill |
| Branch name has no issue reference | Branch was not named with an issue ID | Manually add the related issue reference to the generated description |
