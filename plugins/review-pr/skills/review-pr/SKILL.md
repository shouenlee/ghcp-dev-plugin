---
name: review-pr
description: 'Reviews GitHub pull requests using the gh CLI. Fetches PR diffs, analyzes code quality, verifies unit tests, checks engineering best practices, and posts inline review comments. Use when asked to "review pr", "review pull request", "check this pr", "pr review", or given a PR number/URL to review.'
---

# Review Pull Request

Perform a comprehensive review of a GitHub pull request using the `gh` CLI — analyzing code quality, verifying tests, checking best practices, and posting structured feedback directly on the PR.

## When to Use This Skill

- User asks to "review a PR", "review pull request", or "check this PR"
- User provides a PR number (`#123`), URL, or branch name to review
- User runs `/review-pr` explicitly

## Prerequisites

- Must be inside a git repository with a GitHub remote
- The `gh` CLI must be installed and authenticated (`gh auth status`)
- The target PR must exist on the remote

## Workflow

### Step 1: Identify the PR

Determine which PR to review:

1. If the user provided a PR number (e.g., `#123` or `123`), use that directly.
2. If the user provided a PR URL, extract the number from it.
3. If no PR was specified, detect from the current branch:
   ```
   gh pr view --json number --jq '.number'
   ```
4. If no PR is found, ask the user to specify one.

### Step 2: Fetch PR Context

Gather all necessary information about the PR:

1. **Metadata** — title, description, author, base branch, labels, reviewers:
   ```
   gh pr view <number> --json title,body,author,baseRefName,headRefName,labels,reviewRequests,additions,deletions,changedFiles
   ```
2. **Diff** — the full set of changes:
   ```
   gh pr diff <number>
   ```
3. **CI status** — check results and their pass/fail state:
   ```
   gh pr checks <number>
   ```
4. **Changed files list** — for targeted file reads:
   ```
   gh pr diff <number> --name-only
   ```

### Step 3: Understand PR Intent

Before reviewing any code, understand what the PR is trying to accomplish:

- Read the PR title and description carefully.
- Identify the type of change: feature, bug fix, refactor, docs, config, etc.
- Note the target branch (e.g., merging into `main` vs a feature branch).
- Check if the PR description references issues, design docs, or context.

### Step 4: Holistic Architecture Review

Evaluate the PR at a high level:

- **Goal alignment** — do the changes achieve what the PR description claims?
- **Architecture impact** — does this change affect system boundaries, APIs, data models, or module responsibilities?
- **Scope** — is the PR appropriately scoped, or does it mix unrelated concerns?
- **Breaking changes** — could this break existing consumers, APIs, or contracts?
- **Dependency changes** — are new dependencies justified and well-vetted?

### Step 5: Code Quality Review

Review the diff in detail, reading full files for context when needed:

- **Correctness** — logic errors, off-by-one bugs, race conditions, unhandled edge cases
- **Naming** — do variables, functions, and types have clear, intention-revealing names?
- **Error handling** — are errors caught, propagated, and surfaced appropriately?
- **Security** — injection risks, secrets exposure, auth/authz gaps, input validation
- **Performance** — unnecessary work, N+1 queries, blocking calls, inefficient algorithms
- **DRY / SOLID** — duplication, single-responsibility violations, tight coupling
- **Readability** — could another engineer understand this code without the PR context?

### Step 6: Verify Unit Tests

Assess the testing quality of the PR:

1. **Identify test files** — find test files included in the PR diff.
2. **Flag missing coverage** — identify changed source files that lack corresponding test updates. Not every change needs new tests, but non-trivial logic changes should have them.
3. **Evaluate test quality**:
   - Do tests cover the happy path?
   - Are edge cases and error paths tested?
   - Are assertions meaningful (not just "it doesn't throw")?
   - Do test names clearly describe what is being verified?
4. **Check CI status** — report the outcome of `gh pr checks`. If checks are failing, flag this prominently regardless of code quality.

### Step 7: Generate Structured Report

Present a clear, actionable review to the user:

```
## PR Review: <PR title> (#<number>)

**Author:** <author>  |  **Base:** <base branch>  |  **Changes:** +<additions> / -<deletions> across <N> files

### Summary
<1-3 sentence summary of what the PR does and overall assessment>

### Verdict: <APPROVE | REQUEST CHANGES | COMMENT>

### Findings

#### Critical
- [ ] <file:line> — <description of blocking issue>

#### Warning
- [ ] <file:line> — <description of non-trivial concern>

#### Suggestion
- <file:line> — <optional improvement>

### Test Coverage Assessment
<Summary of test quality, missing coverage, and CI status>

### What's Done Well
<Acknowledge good patterns, clean code, or thorough tests>
```

If there are no findings, say so explicitly and explain why the PR looks good.

### Step 8: Post Inline Comments on GitHub

For each finding from the review, post an inline review comment directly on the PR so feedback appears on the relevant lines in GitHub:

1. Start a pending review so all comments are batched:
   ```
   gh api repos/{owner}/{repo}/pulls/<number>/reviews \
     --method POST \
     --field event=PENDING \
     --field body="" \
     --jq '.id'
   ```
2. For each finding, post a review comment on the specific file and line:
   ```
   gh api repos/{owner}/{repo}/pulls/<number>/reviews/<review_id>/comments \
     --method POST \
     --field path="<file>" \
     --field line=<line_number> \
     --field side=RIGHT \
     --field body="**[<severity>]** <description>"
   ```
3. After posting all comments, ask the user whether to submit the review as APPROVE, REQUEST_CHANGES, or COMMENT before finalizing.

Use `gh repo view --json owner,name --jq '.owner.login + "/" + .name'` to get the owner/repo dynamically.

### Step 9: Offer Next Actions

After presenting the review, offer the user relevant follow-up actions:

- **Approve**: `gh pr review <number> --approve --body "<summary>"`
- **Request changes**: `gh pr review <number> --request-changes --body "<summary>"`
- **Comment only**: `gh pr review <number> --comment --body "<summary>"`
- **View in browser**: `gh pr view <number> --web`

Ask which action the user would like to take, or if they want to adjust any findings before submitting.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `gh` not authenticated | Run `gh auth login` first |
| PR not found | Verify the PR number and that the remote matches |
| No PR for current branch | Specify a PR number explicitly: `/review-pr 123` |
| CI checks not visible | The repo may not have CI configured, or checks haven't run yet |
| Cannot post comments | Verify `gh` has write access to the repository |
