---
name: commit-changes
description: 'Intelligently reviews git diffs and creates well-structured commits with descriptive messages. Automatically splits changes into multiple logical commits when modifications span unrelated concerns. Use when asked to "commit changes", "commit my work", "split commits", "create commits from diffs", "auto-commit", or "review and commit".'
---

# Commit Changes

Review working tree changes, group them by logical concern, and create one or more well-crafted commits with descriptive messages.

## When to Use This Skill

- User asks to "commit changes", "commit my work", or "auto-commit"
- User wants intelligent commit splitting across unrelated changes
- User asks to "review and commit" or "clean up my changes into commits"
- User has a messy working tree and wants organized commit history

## Prerequisites

- Must be inside a git repository
- There must be staged or unstaged changes to commit

## Workflow

### Step 1: Gather Context

1. Run `git status` to see all changed, staged, and untracked files.
2. Run `git diff` to see unstaged changes and `git diff --cached` to see staged changes.
3. Run `git log --oneline -10` to understand the project's existing commit message style and conventions.
4. If there are no changes at all, inform the user and stop.

### Step 2: Analyze and Group Changes

Review all diffs and group changes into **logical units** based on:

- **Feature cohesion**: Files that work together to implement a single feature or fix belong in the same commit.
- **Concern separation**: Unrelated changes (e.g., a bug fix and a new feature, or formatting changes and logic changes) should be split into separate commits.
- **Directory/module boundaries**: Changes scoped to a single module or package often form a natural commit boundary.
- **Dependency order**: If commit B depends on changes in commit A, commit A must come first.

**Guidelines for splitting:**

- A single-file change is usually one commit unless it contains clearly unrelated modifications.
- Changes to tests and their corresponding implementation should be in the same commit.
- Configuration changes, dependency updates, and documentation changes are typically separate commits.
- Purely cosmetic changes (formatting, whitespace, imports) should be their own commit if mixed with functional changes.

**Guidelines for keeping together:**

- Do NOT over-split. If all changes are related to a single concern, use a single commit.
- Related file renames/moves and their import updates belong together.
- A new file and the code that references it belong together.

### Step 3: Present the Commit Plan

Before making any commits, present the plan to the user:

```
I've analyzed your changes and propose the following commit(s):

Commit 1: <type>(<scope>): <summary>
  - path/to/file1.ts
  - path/to/file2.ts

Commit 2: <type>(<scope>): <summary>
  - path/to/file3.ts

Shall I proceed?
```

Wait for user confirmation before executing. If the user wants to adjust the grouping or messages, incorporate their feedback.

### Step 4: Execute Commits

For each commit in the plan, in dependency order:

1. Stage only the files belonging to that commit using `git add <file1> <file2> ...`.
   - If a file contains changes for multiple commits (mixed concerns in one file), use `git add -p` interactively or explain to the user that the file has mixed concerns and ask how they'd like to handle it.
2. Create the commit with the agreed-upon message.
3. Verify the commit was created successfully with `git log --oneline -1`.

### Step 5: Summary

After all commits are created, show a summary:

```
Created N commit(s):
  abc1234 <type>(<scope>): <summary>
  def5678 <type>(<scope>): <summary>
```

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

<body>
```

**Types:**

| Type | Use For |
|------|---------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build, deps, tooling, config |
| `ci` | CI/CD pipeline changes |

**Rules:**

- Summary line must be under 72 characters
- Use imperative mood ("add feature" not "added feature")
- Body explains *what* and *why*, not *how*
- Match the project's existing commit style when possible

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No changes detected | Ensure you have modified files; check `git status` |
| Mixed concerns in one file | Ask the user whether to commit the whole file in one commit or manually split |
| Merge conflicts after partial staging | Reset staging with `git reset HEAD` and re-stage carefully |
| User disagrees with grouping | Adjust the plan based on their feedback before committing |
