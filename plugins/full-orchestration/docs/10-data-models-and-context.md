# 10 — Data Models & Context Passing

Complete reference for every data structure, artifact file, and context handoff in the `/swe` pipeline.

---

## Pipeline State File

**Path**: `.claude/swe-state/{ticket-id}.json`

This is the primary coordination mechanism. Every stage reads it at start, merges its outputs at end. No stage overwrites prior stage data.

### Full Schema

```json
{
  "ticket_id": "PROJ-123",
  "target_branch": "main",
  "feature_branch": "feat/PROJ-123",
  "current_stage": "intake | spec | implement | review | pr",
  "status": "in_progress | failed | aborted | completed",
  "stages": {
    "intake": {
      "completed": false,
      "ticket_file": ".claude/swe-state/PROJ-123/ticket.json"
    },
    "spec": {
      "completed": false,
      "spec_file": ".claude/specs/PROJ-123.md",
      "impl_plan_file": ".claude/specs/PROJ-123-impl.md",
      "context_file": ".claude/specs/PROJ-123-context.md",
      "spec_review_file": ".claude/specs/PROJ-123-review-spec.md",
      "impl_review_file": ".claude/specs/PROJ-123-review-impl.md"
    },
    "implement": {
      "completed": false,
      "impl_summary_file": ".claude/swe-state/PROJ-123/impl-summary.md",
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
      "last_review_commit": null,
      "iterations": 0,
      "phase": "initial | incremental | validation | capped | complete",
      "review_iteration_file": ".claude/swe-state/PROJ-123/review-iteration.md",
      "review_summary_file": ".claude/swe-state/PROJ-123/review-summary.md",
      "findings": {
        "critical": { "total": 0, "fixed": 0, "dismissed": 0 },
        "major": { "total": 0, "fixed": 0, "auto_fixed": 0, "deferred": 0, "dismissed": 0 },
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

### Who Reads / Writes What

| Field | Written By | Read By |
|---|---|---|
| `ticket_id` | `/swe` (init) | All stages |
| `target_branch` | `/swe` (init) | `code_review`, `pr_create` |
| `feature_branch` | `/swe` (init), `tdd_implement` (confirms) | `tdd_implement`, `code_review`, `pr_create` |
| `current_stage` | `/swe` (each dispatch) | `/swe` (resumption) |
| `status` | `/swe` (each dispatch) | `/swe` (resumption) |
| `stages.intake.*` | `ticket_intake` | `spec_writer` |
| `stages.spec.*` | `spec_writer` | `tdd_implement` |
| `stages.implement.*` | `tdd_implement` | `code_review` |
| `stages.review.*` | `code_review` | `pr_create` |
| `stages.pr.*` | `pr_create` | `/swe` (completion) |

### Status Values

| Value | Meaning |
|---|---|
| `in_progress` | A stage is currently running |
| `failed` | A stage encountered an error |
| `aborted` | User chose to abort at a gate |
| `completed` | All stages finished successfully |

### Merge Semantics

Every skill follows this contract:

1. Read existing state file from disk
2. Deep-merge new fields into the existing object
3. Never overwrite fields from prior stages
4. Write the merged result back

This enables resumption — `/swe PROJ-123 --from=implement` loads state and validates that all prior stages show `completed: true`.

---

## Stage 1: Ticket Intake

### Ticket Data

**Path**: `.claude/swe-state/{ticket-id}/ticket.json`

```json
{
  "ticket_id": "PROJ-123",
  "source": "jira | linear | github | generic",
  "url": "https://myorg.atlassian.net/browse/PROJ-123",
  "title": "Add rate limiting to API endpoints",
  "description": "Full ticket body text...",
  "acceptance_criteria": [
    "API returns 429 when rate limit exceeded",
    "Rate limits are configurable per endpoint"
  ],
  "comments": [
    {
      "author": "jane.doe",
      "body": "Should we use sliding window or fixed window?",
      "timestamp": "2026-02-15T10:30:00Z"
    }
  ],
  "linked_issues": [
    {
      "id": "PROJ-100",
      "relationship": "blocks",
      "title": "API performance improvements"
    }
  ],
  "labels": ["enhancement", "api"],
  "priority": "High",
  "assignee": "john.smith",
  "affected_areas": [
    {
      "path": "src/middleware/rate-limiter.ts",
      "category": "existing",
      "reason": "Rate limiter module mentioned in description"
    },
    {
      "path": "src/middleware/rate-limiter.test.ts",
      "category": "test",
      "reason": "Existing test file for rate limiter"
    },
    {
      "path": "src/config/rate-limits.ts",
      "category": "new",
      "reason": "Configuration file referenced but doesn't exist"
    }
  ]
}
```

### Field Sources by Ticketing System

| Field | Jira | Linear | GitHub Issues |
|---|---|---|---|
| `ticket_id` | Issue key (`PROJ-123`) | Issue ID (`LIN-456`) | Issue number (`42`) |
| `source` | `"jira"` | `"linear"` | `"github"` |
| `url` | Extracted from URL or constructed | Extracted from URL | Constructed from repo |
| `title` | `summary` field | `title` field | `title` field |
| `description` | `description` field | `description` field | `body` field |
| `acceptance_criteria` | Parsed from description | Parsed from description | Parsed from body |
| `comments` | `comment` field array | `comments` array | `comments` from `gh` |
| `labels` | `labels` field | `labels` field | `labels` from `gh` |
| `priority` | `priority.name` | `priority` | Inferred from labels |
| `assignee` | `assignee.displayName` | `assignee.name` | `assignees[0].login` |

### Fetch Methods

| System | Method | Command / Tool |
|---|---|---|
| Jira | MCP | `getJiraIssue` with `issueIdOrKey` |
| Linear | MCP | `linear_get_issue` with `issueId` |
| GitHub | CLI | `gh issue view <N> --json title,body,comments,labels,assignees,milestone` |
| Generic | User-provided | curl command or API endpoint |

### Acceptance Criteria Extraction

Parsed from description text by searching for:

- Lines starting with `- [ ]` or `- [x]`
- Numbered lists after headings containing "Acceptance Criteria", "AC", "Requirements", or "Definition of Done"
- Bullet lists in sections titled "Expected Behavior" or "Success Criteria"

---

## Stage 2: Spec & Design

Stage 2 has 5 sub-stages (2A–2E) producing 5 artifact files. All are stored under `.claude/specs/`.

### 2A — Codebase Context Document

**Path**: `.claude/specs/{ticket-id}-context.md`
**Producer**: `spec_writer` orchestrator (merges explorer outputs)
**Consumers**: SpecArchitect (2B), ImplPlanner (2D), TddEngineer (Stage 3), code_review iterate loop (Stage 4)

```markdown
# Codebase Context: {ticket-id}

## Entity Map
Models, schemas, types, interfaces that will be touched or created.
Fields, relationships, validation rules, file locations.

## Dependency Graph
Import chains, API boundaries, downstream consumers.
Blast radius of changes.

## Existing Patterns
How similar features were implemented, coding conventions.
File references and code snippets.

## Test Landscape
Test structure, test file locations, fixture patterns, mock patterns.
Existing tests by type (unit/integration/e2e) and coverage gaps.

## External Integrations
External services, APIs, databases, config files, environment variables.
Connection details, auth patterns, config locations.

## Key Observations
Cross-cutting findings that emerged from multiple explorers.
```

#### Explorer Agent Selection

Which explorers run depends on ticket labels:

| Ticket Type | Labels | Explorers | Count |
|---|---|---|---|
| Bug fix | `bug`, `fix`, `bugfix` | Entity + Test + Pattern | 3 |
| New feature | `feature`, `enhancement` | Entity + Dependency + Pattern + Test + Integration | 5 |
| Refactor | `refactor`, `cleanup`, `tech-debt` | Entity + Dependency + Pattern | 3 |
| API change | `api`, `endpoint`, `rest`, `graphql` | Entity + Dependency + Integration | 3 |
| Default | (no matching labels) | Entity + Dependency + Pattern + Test | 4 |

All explorers are prompt-only `Explore` subagents (built-in Claude Code agent type). They are spawned in a SINGLE message for parallel execution.

#### Explorer Prompts (summarized)

| Explorer | Focus | Output Section |
|---|---|---|
| **Entity** | Models, schemas, types, interfaces, fields, relationships | Entity Map |
| **Dependency** | Import chains, API boundaries, blast radius | Dependency Graph |
| **Pattern** | Similar implementations, coding conventions, file organization | Existing Patterns |
| **Test** | Test structure, fixtures, mocks, coverage gaps | Test Landscape |
| **Integration** | External services, APIs, databases, config, env vars | External Integrations |

### 2B — Technical Spec

**Path**: `.claude/specs/{ticket-id}.md`
**Producer**: `SpecArchitect` agent
**Consumers**: ImplPlanner (2D), spec_review (2C), TddEngineer (Stage 3), pr_create (Stage 5)

```markdown
# Technical Spec: {ticket-title}
**Ticket:** {ticket-id}
**Author:** SpecArchitect agent
**Status:** Draft

## 1. Requirements Summary
Restated requirements, derived requirements, out-of-scope items.

## 2. Affected Components
Files/modules that will change (with file:line refs).
New files to create. Components that won't change.

## 3. Proposed Approach
High-level solution, design decisions with rationale,
rejected alternatives, fit with existing patterns.

## 4. API Changes
New endpoints, modified signatures, backward compat notes.

## 5. Data Model Changes
Schema modifications, migrations, data backfill.

## 6. Risks and Mitigations
Technical risks (HIGH/MEDIUM/LOW), external dependencies,
performance implications.

## 7. Open Questions
Ambiguities needing user input, design trade-offs.
```

#### SpecArchitect Agent

| Property | Value |
|---|---|
| Agent file | `agents/SpecArchitect.agent.md` |
| Model | `opus` |
| Tools | Read, Grep, Write |
| Reads | `ticket.json`, `{ticket-id}-context.md`, referenced source files |
| Writes | `.claude/specs/{ticket-id}.md` |

### 2C — Spec Review

**Path**: `.claude/specs/{ticket-id}-review-spec.md`
**Producer**: `spec_review` skill (consolidates 4 reviewer outputs)
**Consumer**: `spec_writer` (presents to user)

### 2E — Implementation Plan Review

**Path**: `.claude/specs/{ticket-id}-review-impl.md`
**Producer**: `spec_review` skill (same skill, different mode)
**Consumer**: `spec_writer` (presents to user)

#### Consolidated Review Format (shared by 2C and 2E)

```markdown
# Consolidated Review: {ticket-id} ({spec|impl})

## Summary
| Severity | Count |
|---|---|
| CRITICAL | N |
| HIGH | N |
| MEDIUM | N |
| LOW | N |

**Verdict**: PASS | NEEDS REVISION

## CRITICAL Issues
## HIGH Issues
## MEDIUM Suggestions
## LOW Suggestions

## Reviewer Perspectives
### Maintainability
### Security
### Efficiency
### Completeness
```

**Verdict logic**: PASS = zero CRITICAL + zero HIGH. NEEDS REVISION = any CRITICAL or HIGH.

#### Review Context File (ephemeral)

**Path**: `.claude/swe-state/{ticket-id}/review-context.md`

Written by `spec_review` before spawning reviewers. Contains the document under review, ticket data, codebase context, and review mode instructions — all in one file so each reviewer reads a single document.

```markdown
# Review Context: {ticket-id}

## Review Metadata
- **Document path**: {path}
- **Document type**: spec | impl
- **Review mode**: spec | impl
- **Ticket ID**: {ticket-id}

## Document Under Review
{full content}

## Ticket
{ticket.json content or "Not available"}

## Codebase Context
{context doc content or "Not available"}

## Instructions
You are reviewing this document from your specialized perspective.
Review mode is "{review_mode}" — use your corresponding review focus.
```

#### Reviewer Agents

All four are spawned in a SINGLE message for parallel execution.

| Agent | File | Model | Perspective | Checklist Focus |
|---|---|---|---|---|
| MaintainabilityReviewer | `agents/MaintainabilityReviewer.agent.md` | sonnet | Sustainability | Complexity, SoC, naming, coupling, pattern deviation, testability, readability |
| SecurityReviewer | `agents/SecurityReviewer.agent.md` | sonnet | Attack surface | Injection, auth gaps, authorization, data exposure, input validation, insecure defaults, OWASP |
| EfficiencyReviewer | `agents/EfficiencyReviewer.agent.md` | sonnet | Performance | N+1 queries, allocations, caching, unbounded ops, data structures, indexes, resource leaks |
| CompletenessReviewer | `agents/CompletenessReviewer.agent.md` | sonnet | Coverage | AC traceability, edge cases, error handling, rollback, missing steps, test coverage gaps |

Each reviewer produces findings with the same severity scale: CRITICAL / HIGH / MEDIUM / LOW.

#### Review Mode Behavior

Each reviewer operates in two modes determined by the document path:

| Mode | Trigger | Focus |
|---|---|---|
| `spec` | Path matches `{ticket-id}.md` | Design-level review (2C) |
| `impl` | Path matches `{ticket-id}-impl.md` | Step-level review (2E) |

Detection: ticket ID = everything before first known suffix (`-impl.md`, `-context.md`, `-review-*.md`).

### 2D — Implementation Plan

**Path**: `.claude/specs/{ticket-id}-impl.md`
**Producer**: `ImplPlanner` agent
**Consumers**: spec_review (2E), TddEngineer (Stage 3), code_review iterate loop (Stage 4), pr_create (Stage 5)

```markdown
# Implementation Plan: {ticket-title}
**Ticket:** {ticket-id}
**Spec:** .claude/specs/{ticket-id}.md
**Author:** ImplPlanner agent

## 1. File Changes
### New Files
| File Path | Purpose | Lines (est.) |

### Modified Files
| File Path | Line Range | Change Description |

## 2. Function/Method Signatures
Exact signatures for new/modified functions.

## 3. Type/Interface Definitions
New types, modified types, referenced types.

## 4. Database Migrations
Migration file name, complete SQL (up/down), backfill scripts.

## 5. Test Plan
| # | Test Case | Input | Expected Output | Type |

## 6. Implementation Order
### Step 1: {description}
**Files:** path
**Test first:** test file and case name
**Then implement:** what code to write
**Checkpoint:** which tests pass after this step

### Step N: ...

## 7. Rollback Plan
Revert procedure, down migrations, feature flags.
```

#### ImplPlanner Agent

| Property | Value |
|---|---|
| Agent file | `agents/ImplPlanner.agent.md` |
| Model | `opus` |
| Tools | Read, Glob, Grep, Write |
| Reads | `{ticket-id}.md` (spec), `{ticket-id}-context.md`, every file it plans to reference |
| Writes | `.claude/specs/{ticket-id}-impl.md` |

---

## Stage 3: TDD Implementation

### Implementation Summary

**Path**: `.claude/swe-state/{ticket-id}/impl-summary.md`
**Producer**: `TddEngineer` agent
**Consumers**: `code_review` (Stage 4), `pr_create` (Stage 5)

```markdown
# Implementation Summary: {ticket-id}

## Branch
feat/PROJ-123

## Changes
| File | Lines Changed | Description |

## Test Results
- New tests: N
- Modified tests: N
- Total test suite: PASS/FAIL
- Coverage: X% (if available)

## Deviations from Plan
- Any differences from the implementation doc, with rationale

## Notes for Review
- Areas that need extra scrutiny in Stage 4
- Trade-offs made during implementation
```

#### TddEngineer Agent

| Property | Value |
|---|---|
| Agent file | `agents/TddEngineer.agent.md` |
| Model | `opus` |
| Tools | Read, Grep, Glob, Edit, Write, Bash |
| Reads | `{ticket-id}.md`, `{ticket-id}-impl.md`, `{ticket-id}-context.md` |
| Writes | `.claude/swe-state/{ticket-id}/impl-summary.md`, code commits on feature branch |

#### TDD Cycle Per Step

```
RED   → Write failing test → run tests → confirm expected failure
GREEN → Write minimal code → run tests → confirm pass (max 5 attempts)
REFACTOR → Clean up → run full suite → confirm no regressions
COMMIT → "feat({scope}): {what} [TDD step N/{total}]"
```

#### Test Runner Detection

| Language | Runners | Config Files |
|---|---|---|
| Python | pytest | `pyproject.toml`, `pytest.ini`, `setup.cfg` |
| JS/TS | Jest, Vitest, Mocha | `jest.config.js`, `vitest.config.ts`, `.mocharc.yml`, `package.json` |
| Go | go test | `go.mod` |
| Rust | cargo test | `Cargo.toml` |
| Java | JUnit (Maven/Gradle) | `pom.xml`, `build.gradle` |
| Ruby | RSpec, Minitest | `.rspec`, `Gemfile` |
| C# | dotnet test | `*.csproj`, `*.sln` |
| PHP | PHPUnit | `phpunit.xml` |
| Elixir | ExUnit | `mix.exs` |
| Swift | XCTest | `Package.swift` |

#### Commit Convention

| Scenario | Message Format |
|---|---|
| TDD step | `feat({scope}): {what} [TDD step N/{total}]` |
| Dependency install | `chore: add {package} dependency` |
| Blocked step | `WIP: {step description}` |
| Review fix (Stage 4) | `review: fix {severity} — {short description}` |

#### Error Handling

| Scenario | Behavior |
|---|---|
| Red: test fails for wrong reason | Fix test, re-run |
| Green: fails after 5 attempts | WIP commit, note blocker, continue if possible |
| Refactor: regression | Revert refactor, commit pre-refactor, note in summary |
| Full suite: unrelated failure | Investigate; if pre-existing, note in summary |

---

## Stage 4: Code Review

### Deep-Review Context File (ephemeral)

**Path**: `/tmp/deep_review-${CLAUDE_SESSION_ID}-context.yaml`
**Producer**: `deep_review` skill (Phase 1)
**Consumers**: Advocate, Skeptic, Architect agents
**Lifecycle**: Created before agents spawn, deleted after synthesis

```yaml
review:
  type: branch_diff
  base: main
  head: feat/PROJ-123
  title: <summary>
  description: <details>

changed_files:
  - path: src/middleware/rate-limiter.ts
    action: edit
    content: |
      <full new file content>

existing_feedback:           # optional
  - author: <who>
    location: <file:line>
    comment: <text>

observations:
  - <orchestrator notes>
```

### Deep-Review Output: Structured Findings Block

Appended to the human-readable review as a machine-readable YAML comment block. This is the **schema contract** between `deep_review` (producer) and `code_review` (consumer).

```markdown
<!-- structured-findings
findings:
  - id: 1
    priority: critical | high | medium | low
    file: src/middleware/rate-limiter.ts
    line: 42
    summary: "Missing input validation on rate limit config"
    agents: [skeptic, architect]
  - id: 2
    priority: medium
    file: src/config/rate-limits.ts
    line: null
    summary: "Config values not validated at startup"
    agents: [skeptic]
structured-findings -->
```

#### Schema Contract Fields

| Field | Type | Allowed Values |
|---|---|---|
| `id` | integer | Sequential from 1 |
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `file` | string | Relative path from repo root |
| `line` | integer or null | Line number, or null if not applicable |
| `summary` | string | One-line description |
| `agents` | list of strings | `advocate`, `skeptic`, `architect` |

#### Deep-Review Agents

| Agent | Plugin | Model | Perspective |
|---|---|---|---|
| Advocate | `deep-review:Advocate` | (per agent def) | "Why is this correct?" — trust boundaries, design rationale |
| Skeptic | `deep-review:Skeptic` | (per agent def) | "How can I break this?" — bugs, edge cases, code smells |
| Architect | `deep-review:Architect` | (per agent def) | "Is this the right direction?" — system impact, structural smells |

### Severity Mapping (deep-review → pipeline)

| deep-review Priority | Pipeline Severity | Action |
|---|---|---|
| Critical | **Critical** | Blocks merge — must fix before approval |
| High | **Major** | User decides: fix, defer, or dismiss |
| Medium | **Minor** | Auto-fix when possible |
| Low | **Suggestion** | Collect for follow-up items |

### Review Iteration File

**Path**: `.claude/swe-state/{ticket-id}/review-iteration.md`
**Producer**: `code_review` skill (each iteration, overwritten)

Contains the consolidated review from the latest iteration with severity classifications.

### Review Summary

**Path**: `.claude/swe-state/{ticket-id}/review-summary.md`
**Producer**: `code_review` skill (Phase 3)
**Consumers**: `pr_create` (Stage 5)

```
Code Review Complete: {ticket-id}

Iterations: {N}
Branch: {feature-branch}

Resolved:
  - {count} Critical, {count} Major, {count} Minor fixed

Remaining:
  - {count} deferred (see follow-up items)
  - {count} dismissed (with rationale)

Follow-up Items:
  - {suggestion or deferred finding}

Tests: {PASS/FAIL} after review fixes
```

### Auto-Fix Context Passing

In Phases 2A and 2B, when Major or Minor findings need auto-fixing, `code_review` spawns TddEngineer with a scoped prompt:

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  Applying review fixes on {feature_branch}.
  Findings to fix:
  {list with file:line references and severity}

  For each: write/update test, apply fix, run tests, commit.
  Commit message: "review: fix {severity} — {description}"
  Do NOT modify beyond scope of these fixes.
```

### User-Directed Iterate Context Passing

When the user chooses "Iterate" at the approval gate, `code_review` spawns TddEngineer with full context AND user direction:

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  Iterating on implementation based on code review feedback.

  Original inputs:
    Spec:        {spec_file from state}
    Plan:        {impl_plan_file from state}
    Context:     {context_file from state}

  Previous implementation:
    Summary:     {impl_summary_file from state}

  Review feedback:
    Full review: {review_iteration_file from state}

  User direction:
    {verbatim user instruction}

  Read review and impl summary to understand what needs to change.
  Use TDD. Keep all existing tests passing.
  Commit: "review: fix {severity} — {description}"
  Run full suite when done.
  Write updated summary to: {impl_summary_file from state}
```

After completion, `code_review` updates `last_review_commit` and returns to Phase 2B.

### Review Phase Tracking

The `stages.review.phase` field tracks progression:

| Phase Value | Meaning |
|---|---|
| `initial` | Phase 2A in progress |
| `incremental` | Phase 2B in progress |
| `validation` | Phase 2C in progress |
| `capped` | Hit iteration cap without convergence |
| `complete` | User approved at gate |

---

## Stage 5: PR Creation

### PR Content (generated, not persisted as file)

| Component | Source |
|---|---|
| **Title** | `{type}({ticket-id}): {description}` — under 72 chars |
| **Labels** | Mapped from change type (enhancement, bug, refactor, docs, test, security) |
| **Body** | Assembled from pipeline artifacts (see below) |

### PR Body Template

```markdown
## Summary
{2-3 sentence summary}
Resolves [{ticket-id}]({ticket-url})

## Spec
**Goal**: {from spec}
**Approach**: {from spec}
**Key decisions**: {from spec}

## Changes
- `{file}` — {description}

## Test Results
Tests:  {passed} passed, {failed} failed
Suites: {suite-count} passed

## Review Summary
Reviewed by: {reviewer agents}
| Finding | Severity | Resolution |

## Checklist
- [x] Tests pass locally
- [x] Code review completed ({N} iterations)
- [x] No critical or major findings remaining
- [ ] CI pipeline (pending)
```

### PR Body Data Sources

| Section | Read From |
|---|---|
| Summary | `.claude/specs/{ticket-id}.md` (spec) + `ticket.json` |
| Resolves link | `ticket.json` → `url` field |
| Spec | `.claude/specs/{ticket-id}.md` |
| Changes | `.claude/swe-state/{ticket-id}/impl-summary.md` |
| Test Results | `.claude/swe-state/{ticket-id}/impl-summary.md` |
| Review Summary | `.claude/swe-state/{ticket-id}/review-summary.md` |

### Ticket Status Updates (non-fatal)

| System | Method | Action |
|---|---|---|
| Jira | MCP `transitionJiraIssue` + `addCommentToJiraIssue` | Transition to "In Review" + comment with PR URL |
| Linear | MCP `linear_update_issue` + `linear_add_comment` | Update status to "In Review" + comment with PR URL |
| GitHub | `gh issue comment` | Comment with PR URL (auto-linked via `Resolves #N`) |

---

## Complete Artifact Map

### Persistent Files

| Path | Created By | Read By | Lifecycle |
|---|---|---|---|
| `.claude/swe-state/{ticket-id}.json` | `/swe` (init), all stages (merge) | All stages | Entire pipeline |
| `.claude/swe-state/{ticket-id}/ticket.json` | `ticket_intake` | `spec_writer`, `spec_review`, `pr_create` | Entire pipeline |
| `.claude/specs/{ticket-id}-context.md` | `spec_writer` (2A) | SpecArchitect, ImplPlanner, TddEngineer, code_review iterate | Entire pipeline |
| `.claude/specs/{ticket-id}.md` | SpecArchitect (2B) | spec_review (2C), ImplPlanner (2D), TddEngineer, code_review iterate, pr_create | Entire pipeline |
| `.claude/specs/{ticket-id}-review-spec.md` | spec_review (2C) | `spec_writer` (user presentation) | Entire pipeline |
| `.claude/specs/{ticket-id}-impl.md` | ImplPlanner (2D) | spec_review (2E), TddEngineer, code_review iterate, pr_create | Entire pipeline |
| `.claude/specs/{ticket-id}-review-impl.md` | spec_review (2E) | `spec_writer` (user presentation) | Entire pipeline |
| `.claude/swe-state/{ticket-id}/impl-summary.md` | TddEngineer | `code_review`, `pr_create` | Stage 3 onward |
| `.claude/swe-state/{ticket-id}/review-iteration.md` | `code_review` (overwritten each iteration) | `code_review` (approval gate) | Stage 4 |
| `.claude/swe-state/{ticket-id}/review-summary.md` | `code_review` | `pr_create` | Stage 4 onward |
| `.claude/swe-state/{ticket-id}/review-context.md` | `spec_review` | 4 reviewer agents | Stage 2 onward |

### Ephemeral Files

| Path | Created By | Read By | Lifecycle |
|---|---|---|---|
| `/tmp/deep_review-${CLAUDE_SESSION_ID}-context.yaml` | `deep_review` | Advocate, Skeptic, Architect | Deleted after synthesis |

---

## Context Flow Diagram

```
Stage 1                    Stage 2                      Stage 3           Stage 4              Stage 5
─────────────────────────────────────────────────────────────────────────────────────────────────────────

ticket.json ──────────────► spec_writer
                            │
                            ├─ 2A: Explorers ──► context.md ──────────► TddEngineer ──► code_review
                            │                                                           (iterate loop)
                            ├─ 2B: SpecArchitect ──► spec.md ────────► TddEngineer ──► code_review ──► pr_create
                            │                           │                               (iterate loop)
                            │                           ▼
                            ├─ 2C: spec_review ──► review-spec.md
                            │       (reads review-context.md)
                            │
                            ├─ 2D: ImplPlanner ──► impl.md ──────────► TddEngineer ──► code_review
                            │                        │                                  (iterate loop)
                            │                        ▼
                            └─ 2E: spec_review ──► review-impl.md
                                    (reads review-context.md)

                                                                        TddEngineer
                                                                            │
                                                                            ▼
                                                                      impl-summary.md ──► code_review ──► pr_create
                                                                                              │
                                                                                              ▼
                                                                                        review-summary.md ──► pr_create

                                                                        deep_review
                                                                        (ephemeral)
                                                                            │
                                                                            ├─ context.yaml ──► Advocate
                                                                            ├─ context.yaml ──► Skeptic
                                                                            └─ context.yaml ──► Architect
                                                                                    │
                                                                                    ▼
                                                                          structured-findings
                                                                          (in review output)
                                                                                    │
                                                                                    ▼
                                                                          code_review parses
                                                                          and maps severity
```

---

## Agent Summary

| Agent | Plugin | Model | Tools | Role |
|---|---|---|---|---|
| Explore (×3-5) | built-in | — | Read-only | Codebase exploration (2A) |
| SpecArchitect | full-orchestration | opus | Read, Grep, Write | Spec authoring (2B) |
| MaintainabilityReviewer | full-orchestration | sonnet | Read, Grep | Spec/plan review (2C/2E) |
| SecurityReviewer | full-orchestration | sonnet | Read, Grep | Spec/plan review (2C/2E) |
| EfficiencyReviewer | full-orchestration | sonnet | Read, Grep | Spec/plan review (2C/2E) |
| CompletenessReviewer | full-orchestration | sonnet | Read, Grep | Spec/plan review (2C/2E) |
| ImplPlanner | full-orchestration | opus | Read, Glob, Grep, Write | Impl planning (2D) |
| TddEngineer | full-orchestration | opus | Read, Grep, Glob, Edit, Write, Bash | Implementation (3) + review fixes (4) |
| Advocate | deep-review | (per def) | Read-only | Code review — defense (4) |
| Skeptic | deep-review | (per def) | Read-only | Code review — attack (4) |
| Architect | deep-review | (per def) | Read-only | Code review — direction (4) |

---

## User Approval Gates

| Stage | Gate | What User Reviews | Options |
|---|---|---|---|
| 1 | After intake | Parsed ticket summary | Confirm / Edit / Re-fetch |
| 2B | After spec | Technical spec | Approve / Request changes |
| 2C | After spec review | Consolidated review findings | Approve / Update spec + re-review |
| 2D | After impl plan | Implementation plan | Approve / Request changes |
| 2E | After plan review | Consolidated review findings | Approve / Update plan + re-review |
| 4 | After review loop | Final review + remaining findings | Approve / Iterate / Abort |
| 5 | Before PR creation | PR title, labels, body preview | Create / Edit / Cancel |
| 5 | Before push | `git push -u origin {branch}` | Confirm / Cancel |
