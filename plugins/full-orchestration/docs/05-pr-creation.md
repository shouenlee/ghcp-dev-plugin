# 05 — PR Creation

## Purpose

Stage 5 is the final step in the pipeline. It takes the reviewed, approved implementation from [Stage 4](04-code-review.md) and creates a well-structured pull request that links back to the original ticket, summarizes the changes, and includes review and test results. The goal: produce a PR that a human reviewer can evaluate quickly, with full traceability from ticket to implementation.

---

## gh-pr-tools Plugin Reuse

This stage delegates to the [`pr-create`](../../gh-pr-tools/skills/pr-create/SKILL.md) skill from the `gh-pr-tools` plugin. The orchestrator prepares the title, description, and options, then invokes `/pr-create` to handle branch pushing, duplicate detection, and the actual `gh pr create` call.

The orchestrator adds pipeline-specific content (ticket links, spec summary, review results) on top of what `pr-create` normally generates.

---

## PR Format

### Title

```
feat(PROJ-123): short description of the change
```

The title follows conventional commit format:
- **Prefix**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore` — derived from the nature of the changes
- **Scope**: the ticket ID from Stage 1 (e.g., `PROJ-123`, `LIN-456`, `#78`)
- **Description**: concise summary under 70 characters total

### Body

The orchestrator generates a structured PR body that includes:

1. **Ticket link** — direct URL to the source ticket (Jira, Linear, or GitHub Issue)
2. **Spec summary** — condensed version of the Stage 2 spec, focusing on what was built and why
3. **Changes overview** — high-level description of what changed, organized by area
4. **Test results summary** — pass/fail counts from the TDD implementation stage
5. **Review summary** — key findings from Stage 4 and how they were resolved
6. **Labels** — auto-applied based on change type (see below)

### Labels

Labels are applied automatically based on the ticket and change characteristics:

| Change Type | Label |
|-------------|-------|
| New feature | `enhancement` |
| Bug fix | `bug` |
| Refactor | `refactor` |
| Documentation | `docs` |
| Test-only | `test` |
| Security fix | `security` |

Additional labels can be configured per-project in the orchestrator settings.

---

## PR Template

Below is a full example of a generated PR body:

```markdown
## Summary

Adds rate limiting to the `/api/upload` endpoint to prevent abuse.
Implements token bucket algorithm with configurable limits per API key.

Resolves [PROJ-123](https://jira.example.com/browse/PROJ-123)

## Spec

**Goal**: Prevent upload abuse without impacting legitimate users.

**Approach**: Token bucket rate limiter at the middleware layer.
Each API key gets a configurable bucket (default: 100 requests/minute,
burst of 20). Exceeded requests receive 429 with Retry-After header.

**Key decisions**:
- Token bucket over sliding window — better burst tolerance
- Per-key limits stored in Redis — survives restarts, supports horizontal scaling
- Retry-After header uses seconds (RFC 7231 compliant)

Full spec: see commit `a1b2c3d` (spec.md in docs/)

## Changes

- `src/middleware/rate-limiter.ts` — new rate limiting middleware
- `src/config/limits.ts` — rate limit configuration schema
- `src/routes/upload.ts` — apply rate limiter to upload route
- `src/lib/redis.ts` — add token bucket operations
- `tests/middleware/rate-limiter.test.ts` — 14 test cases

## Test Results

```
Tests:  14 passed, 0 failed
Suites: 1 passed
Time:   2.3s
```

## Review Summary

Reviewed by: skeptic, advocate, architect (deep-review plugin)

| Finding | Severity | Resolution |
|---------|----------|------------|
| Missing rate limit on batch endpoint | Major | Fixed — applied same middleware |
| Redis connection failure not handled | Major | Fixed — falls back to in-memory limiter |
| Magic number for default limit | Minor | Fixed — moved to config constant |
| Consider distributed lock for bucket refill | Suggestion | Deferred to PROJ-456 |

## Checklist

- [x] Tests pass locally
- [x] Code review completed (3 iterations)
- [x] No critical or major findings remaining
- [ ] CI pipeline (pending)
```

---

## Ticket Status Updates

After the PR is created, the orchestrator updates the source ticket via MCP:

### Jira

```
MCP tool: atlassian_jira_transition_issue
  issue_key: PROJ-123
  transition: "In Review"

MCP tool: atlassian_jira_add_comment
  issue_key: PROJ-123
  body: "PR created: {pr_url}\n\nChanges: {summary}"
```

### Linear

```
MCP tool: linear_update_issue
  issue_id: LIN-456
  status: "In Review"

MCP tool: linear_create_comment
  issue_id: LIN-456
  body: "PR created: {pr_url}\n\nChanges: {summary}"
```

### GitHub Issues

No MCP needed — the `Resolves #78` line in the PR body auto-links the issue. The orchestrator also adds an explicit comment:

```bash
gh issue comment 78 --body "PR created: {pr_url}"
```

---

## Post-PR Actions

After the PR is created and the ticket is updated:

1. **Comment on ticket** — Add the PR URL and a brief summary to the source ticket (see above).
2. **Request reviewers** — If the project has configured default reviewers or a CODEOWNERS file, request reviews:
   ```bash
   gh pr edit {pr_number} --add-reviewer {reviewer1},{reviewer2}
   ```
   The orchestrator reads from `.github/CODEOWNERS` or a configured reviewer list. This step is skipped if no reviewers are configured.
3. **Run CI checks** — The PR creation triggers CI automatically via GitHub Actions (or the project's CI system). The orchestrator reports the CI status:
   ```bash
   gh pr checks {pr_number} --watch
   ```
   If CI fails, the orchestrator reports the failure and offers to investigate.

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `gh auth` failure | GitHub CLI not authenticated | Prompt user to run `gh auth login` |
| Branch conflict | Target branch has diverged | Offer to rebase the feature branch; ask user before force-pushing |
| PR already exists | Branch already has an open PR | Show existing PR URL; offer to update the description instead |
| MCP ticket update fails | Jira/Linear auth expired or misconfigured | Log warning; continue without ticket update; suggest re-running MCP setup |
| CI failure | Tests or linting fail in CI | Report failing checks; offer to investigate and fix |
| Push rejected | Protected branch rules or permissions | Show error; suggest checking repository permissions |

The orchestrator treats PR creation errors as non-fatal for the pipeline — the implementation and review are already complete. If the PR cannot be created, the orchestrator preserves all artifacts (branch, review summary, spec) so the user can create the PR manually.

---

## Cross-References

- [gh-pr-tools plugin](../../gh-pr-tools/skills/pr-create/SKILL.md) — the `pr-create` skill used to create the PR
- [Stage 4: Code Review](04-code-review.md) — produces the review summary included in the PR
- [Stage 1: Ticket Intake](01-ticket-intake.md) — provides the ticket ID and link used in the PR title and body
- [Stage 2: Spec & Design](02-spec-design.md) — provides the spec summary included in the PR
- [00 — System Overview](00-overview.md) — full pipeline architecture
